package com.getweight.cv.model

/**
 * Итоговая оценка массы животного.
 *
 * @param confidenceIntervalKg полуширина доверительного интервала (кг): реальная
 *   масса ожидается в диапазоне [weightKg - CI, weightKg + CI].
 * @param method "ml_regression" (основной путь к точности ±10 кг) или
 *   "classic_formula_fallback" (используется, если регрессор не найден —
 *   доверительный интервал в этом случае существенно шире).
 */
data class WeightResult(
    val weightKg: Double,
    val confidenceIntervalKg: Double,
    val framesUsed: Int,
    val method: String
)
