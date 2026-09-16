package com.getweight.cv.morphometry

import android.content.Context
import com.getweight.cv.model.AnimalMeasurement
import com.getweight.cv.model.WeightResult
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.support.common.FileUtil

/**
 * Породно-кондиционный коэффициент K для формулы Трухановского.
 * Задаётся пользователем на основе известной породы/упитанности животного.
 */
enum class BreedCondition(val trukhanovskyK: Double) {
    DAIRY_LEAN(1.85),
    DAIRY_AVERAGE(2.0),
    BEEF_AVERAGE(2.2),
    BEEF_FAT(2.5)
}

/**
 * Оценка живой массы по промерам одного кадра.
 *
 * ВАЖНО: классические зоотехнические формулы (Трухановского, Клювера-Штрауха)
 * дают типичную погрешность 20-40 кг (4-8%) на неоднородном поголовье — этого
 * НЕДОСТАТОЧНО для цели ±10 кг. Они используются здесь как baseline/fallback
 * и как признак для лёгкой ML-регрессионной модели `weightRegressor`,
 * дообученной на реальных контрольных взвешиваниях конкретного стада/породы.
 * Без такого дообучения система явно откатывается на formula-fallback с
 * расширенным доверительным интервалом (см. docs/ARCHITECTURE.md, раздел 4.4).
 */
class WeightEstimator(
    context: Context,
    regressorModelPath: String = "models/weight_regressor_fp16.tflite"
) {
    private val regressor: Interpreter? = try {
        Interpreter(FileUtil.loadMappedFile(context, regressorModelPath))
    } catch (e: Exception) {
        null
    }

    /** W(кг) = ОбхватГруди(см)² × КосаяДлина(см) × K / 100 */
    fun trukhanovsky(m: AnimalMeasurement, condition: BreedCondition): Double {
        return (m.heartGirthCm * m.heartGirthCm) * m.obliqueBodyLengthCm * condition.trukhanovskyK / 100.0
    }

    /**
     * Упрощённая полиномиальная аппроксимация табличной поправки
     * Клювера-Штрауха относительно длины тела (для молочного типа КРС).
     */
    fun kluverStrauch(m: AnimalMeasurement): Double {
        val g = m.heartGirthCm
        val l = m.obliqueBodyLengthCm
        return (g * g * l) / 100.0 * (0.85 + 0.0015 * (l - 150))
    }

    private fun regress(m: AnimalMeasurement, condition: BreedCondition): Double? {
        val interpreter = regressor ?: return null
        val features = floatArrayOf(
            m.heartGirthCm.toFloat(),
            m.obliqueBodyLengthCm.toFloat(),
            m.withersHeightCm.toFloat(),
            m.bodyDepthCm.toFloat(),
            m.bodyWidthCm.toFloat(),
            condition.trukhanovskyK.toFloat()
        )
        val input = arrayOf(features)
        val output = Array(1) { FloatArray(1) }
        interpreter.run(input, output)
        return output[0][0].toDouble()
    }

    /**
     * Итоговая оценка по одному кадру: приоритет у дообученной ML-регрессии
     * (основной путь к точности ±10 кг). При её отсутствии — среднее двух
     * классических формул с существенно более широким доверительным
     * интервалом, чтобы не выдавать пользователю псевдоточное число.
     */
    fun estimateSingleFrame(m: AnimalMeasurement, condition: BreedCondition): WeightResult {
        val learned = regress(m, condition)
        return if (learned != null) {
            WeightResult(
                weightKg = learned,
                confidenceIntervalKg = 10.0 * (1.0 - m.frameConfidence).coerceIn(0.3, 1.0),
                framesUsed = 1,
                method = "ml_regression"
            )
        } else {
            val avg = (trukhanovsky(m, condition) + kluverStrauch(m)) / 2.0
            WeightResult(
                weightKg = avg,
                confidenceIntervalKg = 30.0,
                framesUsed = 1,
                method = "classic_formula_fallback"
            )
        }
    }
}
