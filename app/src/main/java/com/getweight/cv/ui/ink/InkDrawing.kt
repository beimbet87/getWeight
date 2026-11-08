package com.getweight.cv.ui.ink

import android.graphics.Canvas
import android.graphics.Paint

/**
 * Рисунок из нескольких штрихов, которые прорисовываются по очереди —
 * в порядке движения пера, с короткой паузой на отрыв пера между ними.
 */
class InkDrawing(
    private val strokes: List<InkStroke>,
    private val style: InkStyle,
    speedScale: Float = 1f
) {
    private val durations = LongArray(strokes.size) {
        maxOf(MIN_STROKE_MS, (strokes[it].length / (style.penSpeed * speedScale)).toLong())
    }

    /** Полное время прорисовки рисунка, мс. */
    val durationMs: Long =
        durations.sum() + style.penLiftMs * (strokes.size - 1).coerceAtLeast(0)

    fun draw(canvas: Canvas, paint: Paint, variant: Int, elapsedMs: Long, extraWidth: Float = 0f) {
        var t0 = 0L
        for (i in strokes.indices) {
            val local = elapsedMs - t0
            if (local <= 0L) break
            val raw = (local.toFloat() / durations[i]).coerceAtMost(1f)
            strokes[i].draw(canvas, paint, variant, ease(raw), extraWidth)
            t0 += durations[i] + style.penLiftMs
        }
    }

    /** Мягкий разгон и торможение пера, без резких рывков. */
    private fun ease(t: Float) = 0.5f * t + 0.5f * t * t * (3f - 2f * t)

    private companion object {
        const val MIN_STROKE_MS = 60L
    }
}
