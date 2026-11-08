package com.getweight.cv.ui.ink

import android.graphics.Canvas
import android.graphics.Paint
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * Один штрих пером: гладкая кривая через контрольные точки, которая рисуется
 * «от руки» — с неровным контуром, переменным нажимом, редкими разрывами и
 * местами двойной линией. Без заливок: только линия.
 *
 * Геометрия кешируется для [InkStyle.BOIL_VARIANTS] вариантов «кипения»;
 * варианты отличаются лишь небольшим смещением, поэтому смена кадров
 * выглядит как мягкое подрагивание, а не как перерисовка другой фигуры.
 *
 * @param controlPoints пары (x, y) в пикселях.
 */
class InkStroke(
    controlPoints: FloatArray,
    private val style: InkStyle,
    private val seed: Int,
    closed: Boolean = false,
    private val weight: Float = 1f,
    allowGaps: Boolean = true,
    allowDouble: Boolean = true
) {
    private val cx: FloatArray
    private val cy: FloatArray
    private val nx: FloatArray
    private val ny: FloatArray
    private val s: FloatArray

    /** Длина штриха в пикселях — определяет время прорисовки пером. */
    val length: Float

    private val gaps: FloatArray
    private var doubleFrom = -1f
    private var doubleTo = -1f
    private var doubleSign = 1f

    private val cache = arrayOfNulls<Geometry>(InkStyle.BOIL_VARIANTS)

    private class Geometry(
        val x: FloatArray, val y: FloatArray, val w: FloatArray,
        val x2: FloatArray?, val y2: FloatArray?, val w2: FloatArray?
    )

    init {
        val dense = densePolyline(controlPoints, closed)
        val res = resample(dense, style.sampleStep)
        cx = res[0]; cy = res[1]; s = res[2]
        length = s[s.size - 1]

        val n = cx.size
        nx = FloatArray(n)
        ny = FloatArray(n)
        for (i in 0 until n) {
            val a = max(0, i - 1)
            val b = minOf(n - 1, i + 1)
            val tx = cx[b] - cx[a]
            val ty = cy[b] - cy[a]
            val len = sqrt(tx * tx + ty * ty)
            if (len > 1e-4f) {
                nx[i] = -ty / len
                ny[i] = tx / len
            }
        }

        val rnd = Random(seed)
        val g = ArrayList<Float>()
        if (allowGaps && length > style.dp(50f)) {
            val count = (length / style.gapEvery * (0.4f + rnd.nextFloat() * 1.2f)).toInt()
            repeat(count) {
                val at = length * (0.15f + 0.7f * rnd.nextFloat())
                val len = style.gapMin + (style.gapMax - style.gapMin) * rnd.nextFloat()
                g += at; g += at + len
            }
        }
        gaps = g.toFloatArray()

        if (allowDouble && length > style.dp(60f) && rnd.nextFloat() < style.doubleChance) {
            val span = length * (0.15f + 0.2f * rnd.nextFloat())
            doubleFrom = (length - span) * rnd.nextFloat()
            doubleTo = doubleFrom + span
            doubleSign = if (rnd.nextBoolean()) 1f else -1f
        }
    }

    /**
     * Рисует штрих.
     * @param variant номер варианта «кипения».
     * @param progress доля пройденного пером пути, 0..1.
     * @param extraWidth добавка к толщине (для светлого ореола под линией).
     */
    fun draw(canvas: Canvas, paint: Paint, variant: Int, progress: Float, extraWidth: Float = 0f) {
        if (progress <= 0f) return
        val geo = geometry(variant)
        val upto = if (progress >= 1f) length else progress * length
        drawPolyline(canvas, paint, geo.x, geo.y, geo.w, 0f, upto, extraWidth, checkGaps = true)
        if (geo.x2 != null && upto > doubleFrom) {
            drawPolyline(
                canvas, paint, geo.x2, geo.y2!!, geo.w2!!,
                doubleFrom, minOf(upto, doubleTo), extraWidth, checkGaps = false
            )
        }
    }

    private fun drawPolyline(
        canvas: Canvas, paint: Paint,
        x: FloatArray, y: FloatArray, w: FloatArray,
        from: Float, upto: Float, extraWidth: Float, checkGaps: Boolean
    ) {
        for (i in 1 until x.size) {
            val s0 = s[i - 1]
            val s1 = s[i]
            if (s0 >= upto) break
            if (s1 <= from) continue
            if (checkGaps && inGap((s0 + s1) * 0.5f)) continue
            var x1 = x[i]
            var y1 = y[i]
            if (s1 > upto && s1 > s0) {
                val t = (upto - s0) / (s1 - s0)
                x1 = x[i - 1] + (x1 - x[i - 1]) * t
                y1 = y[i - 1] + (y1 - y[i - 1]) * t
            }
            paint.strokeWidth = w[i] + extraWidth
            canvas.drawLine(x[i - 1], y[i - 1], x1, y1, paint)
        }
    }

    private fun inGap(at: Float): Boolean {
        var i = 0
        while (i < gaps.size) {
            if (at >= gaps[i] && at <= gaps[i + 1]) return true
            i += 2
        }
        return false
    }

    private fun geometry(variant: Int): Geometry {
        val v = variant.mod(InkStyle.BOIL_VARIANTS)
        return cache[v] ?: build(v).also { cache[v] = it }
    }

    private fun build(v: Int): Geometry {
        val n = cx.size
        val x = FloatArray(n)
        val y = FloatArray(n)
        val w = FloatArray(n)
        val phase = v * 7.31f
        val shiftX = style.boilAmp * 0.6f * InkNoise.hash(v, seed + 17)
        val shiftY = style.boilAmp * 0.6f * InkNoise.hash(v, seed + 29)

        for (i in 0 until n) {
            val si = s[i]
            val d = style.wobbleAmp * InkNoise.value(si / style.wobbleWave, seed) +
                style.boilAmp * InkNoise.value(si / style.boilWave + phase, seed + 101)
            x[i] = cx[i] + nx[i] * d + shiftX
            y[i] = cy[i] + ny[i] * d + shiftY

            val start = (si / style.taperStart).coerceAtMost(1f)
            val end = ((length - si) / style.taperEnd).coerceIn(0f, 1f)
            val pressure = 1f + style.widthJitter * InkNoise.value(si / style.widthWave, seed + 7)
            w[i] = style.baseWidth * weight * pressure * (0.45f + 0.55f * start) * (0.4f + 0.6f * end)
        }

        if (doubleFrom < 0f) return Geometry(x, y, w, null, null, null)

        val x2 = FloatArray(n)
        val y2 = FloatArray(n)
        val w2 = FloatArray(n)
        val span = doubleTo - doubleFrom
        for (i in 0 until n) {
            val si = s[i]
            val off = doubleSign * style.doubleOffset *
                (0.75f + 0.45f * InkNoise.value(si / (style.wobbleWave * 0.6f), seed + 33)) +
                style.boilAmp * InkNoise.value(si / style.boilWave + phase, seed + 211)
            x2[i] = x[i] + nx[i] * off
            y2[i] = y[i] + ny[i] * off
            val t = ((si - doubleFrom) / span).coerceIn(0f, 1f)
            val fade = sin(PI * t).toFloat()
            w2[i] = style.baseWidth * weight * 0.55f * (0.3f + 0.7f * fade)
        }
        return Geometry(x, y, w, x2, y2, w2)
    }

    /** Catmull-Rom через контрольные точки; замкнутый контур — с перехлёстом. */
    private fun densePolyline(p: FloatArray, closed: Boolean): FloatArray {
        val count = p.size / 2
        if (count < 2) {
            val x = if (count == 1) p[0] else 0f
            val y = if (count == 1) p[1] else 0f
            return floatArrayOf(x, y, x, y)
        }
        fun px(i: Int) = if (closed) p[2 * i.mod(count)] else p[2 * i.coerceIn(0, count - 1)]
        fun py(i: Int) = if (closed) p[2 * i.mod(count) + 1] else p[2 * i.coerceIn(0, count - 1) + 1]

        val out = ArrayList<Float>()
        val segments = if (closed) count else count - 1
        val sub = 12
        for (i in 0 until segments) {
            for (k in 0 until sub) {
                val t = k / sub.toFloat()
                out += catmull(px(i - 1), px(i), px(i + 1), px(i + 2), t)
                out += catmull(py(i - 1), py(i), py(i + 1), py(i + 2), t)
            }
        }
        out += px(segments); out += py(segments)

        if (closed) {
            // Перо проходит чуть дальше начала: концы контура не сходятся идеально.
            var travelled = 0f
            var i = 2
            while (i + 1 < out.size && travelled < style.overshoot) {
                val dx = out[i] - out[i - 2]
                val dy = out[i + 1] - out[i - 1]
                travelled += sqrt(dx * dx + dy * dy)
                out += out[i]; out += out[i + 1]
                i += 2
            }
        }
        return out.toFloatArray()
    }

    private fun catmull(p0: Float, p1: Float, p2: Float, p3: Float, t: Float): Float {
        val t2 = t * t
        val t3 = t2 * t
        return 0.5f * (2f * p1 + (-p0 + p2) * t + (2f * p0 - 5f * p1 + 4f * p2 - p3) * t2 +
            (-p0 + 3f * p1 - 3f * p2 + p3) * t3)
    }

    /** Равномерная по длине дискретизация: [x[], y[], s[]]. */
    private fun resample(dense: FloatArray, step: Float): Array<FloatArray> {
        val xs = ArrayList<Float>()
        val ys = ArrayList<Float>()
        val ss = ArrayList<Float>()
        xs += dense[0]; ys += dense[1]; ss += 0f
        var acc = 0f
        var next = step
        var i = 2
        while (i + 1 < dense.size) {
            val ax = dense[i - 2]
            val ay = dense[i - 1]
            val bx = dense[i]
            val by = dense[i + 1]
            val seg = sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay))
            while (seg > 0f && acc + seg >= next) {
                val t = (next - acc) / seg
                xs += ax + (bx - ax) * t
                ys += ay + (by - ay) * t
                ss += next
                next += step
            }
            acc += seg
            i += 2
        }
        if (acc - ss.last() > 1e-3f || xs.size < 2) {
            xs += dense[dense.size - 2]; ys += dense[dense.size - 1]; ss += acc
        }
        return arrayOf(xs.toFloatArray(), ys.toFloatArray(), ss.toFloatArray())
    }
}
