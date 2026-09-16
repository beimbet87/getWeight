package com.getweight.cv.pose

import com.getweight.cv.model.BodyLandmark
import com.getweight.cv.model.Keypoint
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.sqrt

/**
 * Отбраковывает кадры, не соответствующие протоколу съёмки (см.
 * docs/ARCHITECTURE.md, раздел 2 "Протокол съёмки"):
 *  - боковая проекция животного (yaw ≈ 0°), а не ракурс 3/4;
 *  - плоскость животного/маркера перпендикулярна оси камеры;
 *  - все четыре конечности видны и расставлены раздельно;
 *  - достаточная уверенность модели по каждой обязательной ключевой точке.
 *
 * Отбраковка на этом этапе принципиально важна: она устраняет систематические
 * ошибки (bias) ракурса и перспективы ДО их попадания в промеры, тогда как
 * усреднение по кадрам умеет гасить только случайный шум, а не сдвиг.
 */
class PoseValidator(
    private val minKeypointConfidence: Float = 0.55f,
    private val maxYawDeg: Double = 8.0,
    private val maxMarkerTiltDeg: Double = 6.0,
    private val minHoofSeparationRatio: Double = 0.06 // доля от длины тела
) {

    sealed class ValidationResult {
        object Valid : ValidationResult()
        data class Rejected(val reason: String) : ValidationResult()
    }

    private val requiredLandmarks = listOf(
        BodyLandmark.WITHERS, BodyLandmark.SHOULDER_JOINT,
        BodyLandmark.ISCHIAL_TUBEROSITY, BodyLandmark.CHEST_FLOOR,
        BodyLandmark.CHEST_TOP,
        BodyLandmark.FRONT_HOOF_FRONT, BodyLandmark.FRONT_HOOF_REAR,
        BodyLandmark.REAR_HOOF_FRONT, BodyLandmark.REAR_HOOF_REAR
    )

    fun validate(
        keypoints: Map<BodyLandmark, Keypoint>,
        markerTiltDeg: Double?
    ): ValidationResult {
        for (landmark in requiredLandmarks) {
            val kp = keypoints[landmark]
                ?: return ValidationResult.Rejected("missing landmark: $landmark")
            if (kp.confidence < minKeypointConfidence) {
                return ValidationResult.Rejected(
                    "low confidence on $landmark (${kp.confidence})"
                )
            }
        }

        if (markerTiltDeg != null && markerTiltDeg > maxMarkerTiltDeg) {
            return ValidationResult.Rejected(
                "camera not perpendicular to subject plane: tilt=$markerTiltDeg deg"
            )
        }

        val yaw = estimateYawDeg(keypoints)
        if (abs(yaw) > maxYawDeg) {
            return ValidationResult.Rejected("yaw out of range: $yaw deg")
        }

        if (!hoovesSeparated(keypoints)) {
            return ValidationResult.Rejected("legs occluded / not a square stance")
        }

        return ValidationResult.Valid
    }

    /**
     * Грубая оценка рыскания (yaw) по наклону линии "холка → корень хвоста".
     * При строго боковом ракурсе эта линия близка к горизонтали кадра.
     */
    private fun estimateYawDeg(keypoints: Map<BodyLandmark, Keypoint>): Double {
        val withers = keypoints.getValue(BodyLandmark.WITHERS)
        val tail = keypoints[BodyLandmark.TAIL_HEAD]
            ?: keypoints.getValue(BodyLandmark.ISCHIAL_TUBEROSITY)
        val dx = (tail.xPx - withers.xPx).toDouble()
        val dy = (tail.yPx - withers.yPx).toDouble()
        return Math.toDegrees(atan2(dy, dx))
    }

    private fun hoovesSeparated(keypoints: Map<BodyLandmark, Keypoint>): Boolean {
        val bodyLength = distance(
            keypoints.getValue(BodyLandmark.SHOULDER_JOINT),
            keypoints.getValue(BodyLandmark.ISCHIAL_TUBEROSITY)
        )
        val frontSep = distance(
            keypoints.getValue(BodyLandmark.FRONT_HOOF_FRONT),
            keypoints.getValue(BodyLandmark.FRONT_HOOF_REAR)
        )
        val rearSep = distance(
            keypoints.getValue(BodyLandmark.REAR_HOOF_FRONT),
            keypoints.getValue(BodyLandmark.REAR_HOOF_REAR)
        )
        val minSep = bodyLength * minHoofSeparationRatio
        return frontSep >= minSep && rearSep >= minSep
    }

    private fun distance(a: Keypoint, b: Keypoint): Double {
        val dx = (a.xPx - b.xPx).toDouble()
        val dy = (a.yPx - b.yPx).toDouble()
        return sqrt(dx * dx + dy * dy)
    }
}
