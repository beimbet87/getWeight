package com.getweight.cv.morphometry

import com.getweight.cv.model.AnimalMeasurement
import com.getweight.cv.model.BodyLandmark
import com.getweight.cv.model.Keypoint
import kotlin.math.sqrt

/**
 * Переводит пиксельные координаты ключевых точек в зоотехнические промеры
 * (см), используя масштаб пиксель→см от ArucoCalibrator и, опционально,
 * глубину груди от ARCore Depth API / ToF / LiDAR для эллиптической
 * аппроксимации обхвата груди.
 *
 * Обхват груди принципиально нельзя точно получить из одного бокового кадра:
 * видна лишь ширина (проекция на плоскость кадра), а не глубина грудной
 * клетки. Поэтому обхват аппроксимируется периметром эллипса Рамануджана по
 * большой (bodyWidth) и малой (bodyDepth) полуосям. При отсутствии сенсора
 * глубины bodyDepth оценивается через породный коэффициент
 * `depthToWidthRatio` — это осознанный источник остаточной ошибки, см.
 * docs/ARCHITECTURE.md, раздел 4.2.
 */
class BodyMeasurements(
    private val depthToWidthRatio: Double = 0.86 // эмпирический коэффициент по умолчанию (молочный скот)
) {

    fun compute(
        keypoints: Map<BodyLandmark, Keypoint>,
        pixelsPerCm: Double,
        measuredBodyDepthCm: Double? = null,
        frameConfidence: Float
    ): AnimalMeasurement {
        val shoulder = keypoints.getValue(BodyLandmark.SHOULDER_JOINT)
        val ischium = keypoints.getValue(BodyLandmark.ISCHIAL_TUBEROSITY)
        val withers = keypoints.getValue(BodyLandmark.WITHERS)
        val chestFloor = keypoints.getValue(BodyLandmark.CHEST_FLOOR)
        val chestTop = keypoints.getValue(BodyLandmark.CHEST_TOP)

        val obliqueLengthPx = pixelDistance(shoulder, ischium)
        val withersHeightPx = pixelDistance(withers, chestFloor)
        val bodyWidthPx = pixelDistance(chestFloor, chestTop)

        val obliqueLengthCm = obliqueLengthPx / pixelsPerCm
        val withersHeightCm = withersHeightPx / pixelsPerCm
        val bodyWidthCm = bodyWidthPx / pixelsPerCm
        val bodyDepthCm = measuredBodyDepthCm ?: (bodyWidthCm * depthToWidthRatio)

        val heartGirthCm = ellipsePerimeterRamanujan(bodyWidthCm / 2.0, bodyDepthCm / 2.0)

        return AnimalMeasurement(
            obliqueBodyLengthCm = obliqueLengthCm,
            heartGirthCm = heartGirthCm,
            withersHeightCm = withersHeightCm,
            bodyDepthCm = bodyDepthCm,
            bodyWidthCm = bodyWidthCm,
            frameConfidence = frameConfidence
        )
    }

    private fun pixelDistance(a: Keypoint, b: Keypoint): Double {
        val dx = (a.xPx - b.xPx).toDouble()
        val dy = (a.yPx - b.yPx).toDouble()
        return sqrt(dx * dx + dy * dy)
    }

    private fun ellipsePerimeterRamanujan(a: Double, b: Double): Double {
        val h = ((a - b) * (a - b)) / ((a + b) * (a + b))
        return Math.PI * (a + b) * (1 + (3 * h) / (10 + sqrt(4 - 3 * h)))
    }
}
