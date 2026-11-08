package com.getweight.cv.ui.ink

import android.content.Context
import androidx.core.content.ContextCompat
import com.getweight.cv.R

/**
 * Параметры «рисунка тушью от руки». Все размеры — в пикселях,
 * пересчитаны из dp по плотности экрана.
 */
class InkStyle(context: Context) {
    private val d = context.resources.displayMetrics.density

    val ink = ContextCompat.getColor(context, R.color.ink)
    val inkSoft = ContextCompat.getColor(context, R.color.ink_soft)
    val paper = ContextCompat.getColor(context, R.color.paper)

    /** Базовая толщина пера и её разброс (доля). */
    val baseWidth = 1.7f * d
    val widthJitter = 0.35f
    val widthWave = 36f * d

    /** Шаг дискретизации линии. */
    val sampleStep = 2.5f * d

    /** Медленное «дрожание руки» — постоянно для штриха. */
    val wobbleAmp = 1.4f * d
    val wobbleWave = 90f * d

    /** «Кипение»: небольшое смещение, меняющееся каждый кадр кипения. */
    val boilAmp = 0.55f * d
    val boilWave = 26f * d

    /** Двойная линия: смещение второго прохода пера. */
    val doubleOffset = 1.8f * d
    val doubleChance = 0.55f

    /** Разрывы: в среднем один на [gapEvery] длины, длиной gapMin..gapMax. */
    val gapEvery = 260f * d
    val gapMin = 3f * d
    val gapMax = 7f * d

    /** Перехлёст концов замкнутых контуров. */
    val overshoot = 5f * d

    /** Нажим в начале и сход пера в конце штриха. */
    val taperStart = 5f * d
    val taperEnd = 10f * d

    /** Скорость пера (px/мс), письма текста и пауза на отрыв пера. */
    val penSpeed = 0.75f * d
    val writeSpeed = 0.32f * d
    val penLiftMs = 70L

    /** 10 перерисовок контура в секунду. */
    val boilIntervalMs = 100L

    fun dp(v: Float) = v * d

    companion object {
        /** Сколько вариантов контура циклически сменяют друг друга. */
        const val BOIL_VARIANTS = 3
    }
}
