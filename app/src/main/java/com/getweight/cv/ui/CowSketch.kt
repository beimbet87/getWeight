package com.getweight.cv.ui

import android.graphics.RectF
import com.getweight.cv.ui.ink.InkDrawing
import com.getweight.cv.ui.ink.InkStroke
import com.getweight.cv.ui.ink.InkStyle

/**
 * Контурный набросок коровы в профиль (голова слева). Координаты — в
 * условном поле 200×120; порядок штрихов — порядок движения пера.
 */
object CowSketch {

    private const val W = 200f
    private const val H = 120f

    private class Line(val pts: FloatArray, val closed: Boolean = false, val weight: Float = 1f)

    private val lines = listOf(
        // голова
        Line(floatArrayOf(38f, 27f, 30f, 29f, 23f, 37f, 17f, 48f, 14f, 56f, 17f, 61f, 25f, 62f, 33f, 57f, 40f, 52f, 46f, 50f)),
        Line(floatArrayOf(37f, 26f, 35f, 19f, 31f, 15f), weight = 0.9f),           // рог
        Line(floatArrayOf(42f, 29f, 51f, 25f, 47f, 32f), weight = 0.9f),           // ухо
        Line(floatArrayOf(27f, 40f, 30f, 39f), weight = 1.1f),                     // глаз
        Line(floatArrayOf(17f, 54f, 19f, 55f), weight = 0.9f),                     // ноздря
        // спина от затылка через холку к корню хвоста
        Line(floatArrayOf(40f, 27f, 56f, 20f, 80f, 23f, 110f, 24f, 140f, 22f, 160f, 21f, 176f, 27f)),
        // хвост
        Line(floatArrayOf(176f, 28f, 181f, 38f, 183f, 58f, 182f, 80f, 179f, 90f, 184f, 93f), weight = 0.85f),
        // задняя нога
        Line(floatArrayOf(175f, 30f, 180f, 46f, 177f, 64f, 171f, 78f, 170f, 96f, 172f, 111f)),
        Line(floatArrayOf(173f, 112f, 163f, 112f)),
        Line(floatArrayOf(162f, 111f, 161f, 96f, 156f, 82f, 148f, 76f)),
        // вымя
        Line(floatArrayOf(148f, 76f, 147f, 86f, 140f, 90f, 133f, 86f, 132f, 78f), weight = 0.9f),
        // живот
        Line(floatArrayOf(132f, 79f, 112f, 83f, 86f, 83f, 66f, 78f)),
        // передняя нога
        Line(floatArrayOf(66f, 78f, 63f, 94f, 63f, 111f)),
        Line(floatArrayOf(64f, 112f, 53f, 112f)),
        Line(floatArrayOf(53f, 111f, 53f, 94f, 49f, 74f, 45f, 60f, 46f, 50f)),
        // дальние ноги
        Line(floatArrayOf(74f, 83f, 76f, 108f), weight = 0.75f),
        Line(floatArrayOf(152f, 84f, 154f, 108f), weight = 0.75f),
        // пятно — только контур
        Line(floatArrayOf(95f, 35f, 108f, 32f, 118f, 40f, 112f, 50f, 99f, 49f, 92f, 42f), closed = true, weight = 0.8f),
        // земля
        Line(floatArrayOf(4f, 114f, 60f, 115f, 130f, 113.5f, 196f, 114.5f), weight = 0.7f)
    )

    /** Рисунок, вписанный в [bounds] с сохранением пропорций. */
    fun drawing(bounds: RectF, style: InkStyle, seed: Int = 7): InkDrawing {
        val scale = minOf(bounds.width() / W, bounds.height() / H)
        val ox = bounds.centerX() - W * scale / 2f
        val oy = bounds.centerY() - H * scale / 2f
        val strokes = lines.mapIndexed { i, line ->
            val pts = FloatArray(line.pts.size) { k ->
                if (k % 2 == 0) ox + line.pts[k] * scale else oy + line.pts[k] * scale
            }
            InkStroke(
                pts, style, seed = seed * 131 + i * 17,
                closed = line.closed, weight = line.weight
            )
        }
        return InkDrawing(strokes, style)
    }
}
