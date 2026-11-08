package com.getweight.cv.pipeline

import android.content.Context
import android.graphics.Bitmap
import com.getweight.cv.calibration.ArucoCalibrator
import com.getweight.cv.filter.KalmanFilter1D
import com.getweight.cv.ml.KeypointDetector
import com.getweight.cv.model.BodyLandmark
import com.getweight.cv.model.Keypoint
import com.getweight.cv.model.WeightResult
import com.getweight.cv.morphometry.BodyMeasurements
import com.getweight.cv.morphometry.BreedCondition
import com.getweight.cv.morphometry.WeightEstimator
import com.getweight.cv.pose.PoseValidator
import org.opencv.android.Utils
import org.opencv.core.Mat
import org.opencv.imgproc.Imgproc

/**
 * Оркестрирует полный конвейер по серии кадров короткого видеофрагмента:
 * калибровка → валидация позы → ключевые точки → промеры → вес по кадру →
 * отбраковка выбросов → сглаживание Калманом → итоговый результат.
 *
 * Один экземпляр соответствует одной сессии измерения одного животного —
 * состояние (Kalman, история весов) накапливается между вызовами
 * `processFrame` и должно быть сброшено (`reset()`) перед измерением
 * следующего животного.
 */
class WeightPipeline(context: Context) {

    private val calibrator = ArucoCalibrator()
    private val poseValidator = PoseValidator()
    private val keypointDetector = KeypointDetector(context)
    private val bodyMeasurements = BodyMeasurements()
    private val weightEstimator = WeightEstimator(context)

    private var kalman: KalmanFilter1D? = null
    private val acceptedWeights = mutableListOf<Double>()
    private var rejectedFrames = 0
    private var processedFrames = 0

    /**
     * Ключевые точки последнего обработанного кадра (для отрисовки скелета),
     * или `null`, если до детекции дело не дошло (например, нет маркера).
     */
    @Volatile
    var lastKeypoints: Map<BodyLandmark, Keypoint>? = null
        private set

    /**
     * Обрабатывает один кадр. Возвращает `null`, если кадр отбракован
     * (нет маркера в кадре, невалидная поза/ракурс, или оценка — выброс
     * относительно уже принятых кадров).
     */
    fun processFrame(bitmap: Bitmap, condition: BreedCondition): WeightResult? {
        processedFrames++
        lastKeypoints = null

        val rgbMat = Mat()
        val gray = Mat()
        Utils.bitmapToMat(bitmap, rgbMat)
        Imgproc.cvtColor(rgbMat, gray, Imgproc.COLOR_RGBA2GRAY)

        val calibration = calibrator.detect(gray)
            ?: return reject() // нет маркера в кадре -> нет надёжного масштаба

        val keypoints = keypointDetector.detect(bitmap)
        lastKeypoints = keypoints

        val validation = poseValidator.validate(keypoints, calibration.cameraTiltDeg)
        if (validation is PoseValidator.ValidationResult.Rejected) {
            return reject()
        }

        val avgConfidence = keypoints.values.map { it.confidence }.average().toFloat()
        val measurement = bodyMeasurements.compute(
            keypoints = keypoints,
            pixelsPerCm = calibration.pixelsPerCm,
            frameConfidence = avgConfidence
        )

        val frameResult = weightEstimator.estimateSingleFrame(measurement, condition)

        // Отбраковка выбросов относительно медианы уже принятых кадров —
        // устойчивее к единичным ошибкам детекции, чем чистое усреднение.
        if (acceptedWeights.size >= 3) {
            val median = acceptedWeights.sorted()[acceptedWeights.size / 2]
            if (Math.abs(frameResult.weightKg - median) > 0.15 * median) {
                return reject()
            }
        }

        acceptedWeights.add(frameResult.weightKg)

        val filter = kalman ?: KalmanFilter1D(estimate = frameResult.weightKg).also { kalman = it }
        val smoothed = filter.update(frameResult.weightKg, avgConfidence)

        return WeightResult(
            weightKg = smoothed,
            confidenceIntervalKg = frameResult.confidenceIntervalKg / Math.sqrt(acceptedWeights.size.toDouble()),
            framesUsed = acceptedWeights.size,
            method = frameResult.method
        )
    }

    private fun reject(): WeightResult? {
        rejectedFrames++
        return null
    }

    fun rejectionRate(): Double =
        if (processedFrames == 0) 0.0 else rejectedFrames.toDouble() / processedFrames

    /** Сбросить состояние сессии перед измерением следующего животного. */
    fun reset() {
        kalman = null
        acceptedWeights.clear()
        rejectedFrames = 0
        processedFrames = 0
    }

    fun close() {
        keypointDetector.close()
    }
}
