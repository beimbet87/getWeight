package com.getweight.cv.filter

/**
 * Простой 1D фильтр Калмана для сглаживания серии покадровых оценок массы.
 * Снижает дисперсию, вносимую шумом детекции ключевых точек и мелкими
 * отклонениями позы между кадрами короткой видеосерии (~1-2 сек, 10-15
 * кадров). Кадры с низкой уверенностью модели (measurementConfidence)
 * получают меньший вес в обновлении оценки.
 */
class KalmanFilter1D(
    private var estimate: Double,
    private var errorCovariance: Double = 1.0,
    private val processNoise: Double = 0.01,
    private val measurementNoiseBase: Double = 1.0
) {
    fun update(measurement: Double, measurementConfidence: Float): Double {
        val measurementNoise = measurementNoiseBase / measurementConfidence.coerceAtLeast(0.05f)

        errorCovariance += processNoise
        val kalmanGain = errorCovariance / (errorCovariance + measurementNoise)
        estimate += kalmanGain * (measurement - estimate)
        errorCovariance *= (1 - kalmanGain)

        return estimate
    }

    fun currentEstimate(): Double = estimate
}
