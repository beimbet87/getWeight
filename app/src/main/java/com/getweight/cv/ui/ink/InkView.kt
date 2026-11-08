package com.getweight.cv.ui.ink

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.os.SystemClock
import android.util.AttributeSet
import android.view.View

/**
 * База для видов, рисующих тушью. Держит часы прорисовки и «кипения»:
 * пока идёт прорисовка пером — перерисовка на каждом кадре экрана, после —
 * только 10 раз в секунду, когда меняется вариант контура.
 *
 * Если в системе отключены анимации, рисунок показывается сразу и не кипит.
 */
abstract class InkView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    protected val ink = InkStyle(context)

    protected val inkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ink.ink
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    private val boilTick = Runnable { invalidate() }

    protected val motionEnabled: Boolean
        get() = ValueAnimator.areAnimatorsEnabled()

    protected fun now(): Long = SystemClock.uptimeMillis()

    /** Время с начала прорисовки; без анимаций — «уже всё нарисовано». */
    protected fun elapsed(start: Long, now: Long): Long =
        if (motionEnabled) now - start else Long.MAX_VALUE / 4

    protected fun boilVariant(now: Long): Int =
        if (motionEnabled) ((now / ink.boilIntervalMs) % InkStyle.BOIL_VARIANTS).toInt() else 0

    /** Рисует содержимое; возвращает true, пока идёт прорисовка пером. */
    protected abstract fun drawInk(canvas: Canvas, now: Long): Boolean

    final override fun onDraw(canvas: Canvas) {
        val t = now()
        val revealing = drawInk(canvas, t)
        removeCallbacks(boilTick)
        if (windowVisibility != VISIBLE || !motionEnabled) return
        if (revealing) {
            postInvalidateOnAnimation()
        } else {
            postDelayed(boilTick, ink.boilIntervalMs - t % ink.boilIntervalMs)
        }
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        if (visibility == VISIBLE) invalidate() else removeCallbacks(boilTick)
    }

    override fun onDetachedFromWindow() {
        removeCallbacks(boilTick)
        super.onDetachedFromWindow()
    }
}
