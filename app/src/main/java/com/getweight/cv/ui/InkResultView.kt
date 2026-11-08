package com.getweight.cv.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.RectF
import android.graphics.Typeface
import android.text.TextPaint
import android.util.AttributeSet
import android.util.TypedValue
import com.getweight.cv.R
import com.getweight.cv.model.WeightResult
import com.getweight.cv.ui.ink.InkDrawing
import com.getweight.cv.ui.ink.InkStroke
import com.getweight.cv.ui.ink.InkView
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.roundToInt

/**
 * Панель результата на бумаге.
 *
 * Пока оценки нет — контурный набросок коровы и подсказка. Когда оценка
 * появилась — вес, подчёркнутый пером, и шкала с указателем и скобкой
 * доверительного интервала. Текст «пишется» слева направо вслед за пером.
 */
class InkResultView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : InkView(context, attrs) {

    private val pad = ink.dp(20f)

    private val serif = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
    private val serifItalic = Typeface.create(Typeface.SERIF, Typeface.ITALIC)

    private val captionPaint = textPaint(16f, serifItalic, ink.ink)
    private val statusPaint = textPaint(13f, serifItalic, ink.inkSoft)
    private val numberPaint = textPaint(46f, serif, ink.ink)
    private val unitPaint = textPaint(20f, serifItalic, ink.ink)
    private val metaPaint = textPaint(14f, serifItalic, ink.inkSoft)
    private val tickPaint = textPaint(12f, serif, ink.inkSoft).apply { textAlign = android.graphics.Paint.Align.CENTER }

    private val hint = resources.getString(R.string.hint_point_camera)
    private var status: String? = null

    // Режим подсказки
    private var cow: InkDrawing? = null
    private var hintStart = 0L
    private var captionSize = captionPaint.textSize

    // Режим результата
    private var result: WeightResult? = null
    private var resultStart = 0L
    private var shownWeight = 0.0
    private var shownCi = 0.0
    private var lastFrameTime = 0L
    private var rulerLo = 0.0
    private var ruler: InkDrawing? = null
    private var underline: InkDrawing? = null
    private var underlineWidth = 0f
    private var marker: InkDrawing? = null
    private var markerKey = Long.MIN_VALUE

    /** Новая сглаженная оценка массы. */
    fun showResult(r: WeightResult) {
        val t = now()
        if (result == null) {
            resultStart = t
            shownWeight = r.weightKg
            shownCi = r.confidenceIntervalKg
            lastFrameTime = t
            ruler = null
            underline = null
            marker = null
        }
        result = r
        status = resources.getString(R.string.status_frames_used, r.framesUsed)
        contentDescription = "%.0f %s".format(r.weightKg, resources.getString(R.string.unit_kg))
        invalidate()
    }

    /** Кадр отбракован; прошлый результат, если был, остаётся на месте. */
    fun showRejected(rejectionRate: Double) {
        status = resources.getString(R.string.status_frame_rejected, (rejectionRate * 100).roundToInt())
        invalidate()
    }

    /** Начать новое измерение: вернуть подсказку и набросок. */
    fun reset() {
        result = null
        status = null
        cow = null
        contentDescription = hint
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        cow = null
        ruler = null
        underline = null
        marker = null
    }

    override fun drawInk(canvas: Canvas, now: Long): Boolean {
        if (width == 0 || height == 0) return false
        val r = result
        return if (r == null) drawHint(canvas, now) else drawResult(canvas, now, r)
    }

    // ---------- подсказка ----------

    private fun drawHint(canvas: Canvas, now: Long): Boolean {
        val statusBaseline = height - pad
        val captionBaseline = statusBaseline - ink.dp(24f)
        val drawing = cow ?: run {
            captionSize = fitTextSize(hint, captionPaint, 16f, width - 2 * pad)
            val bounds = RectF(pad, pad * 0.6f, width - pad, captionBaseline - ink.dp(28f))
            hintStart = now
            CowSketch.drawing(bounds, ink).also { cow = it }
        }
        captionPaint.textSize = captionSize

        val variant = boilVariant(now)
        val e = elapsed(hintStart, now)
        drawing.draw(canvas, inkPaint, variant, e)

        val captionStart = (drawing.durationMs * 0.6).toLong()
        val captionWidth = captionPaint.measureText(hint)
        val captionX = (width - captionWidth) / 2f
        val captionDone = writeText(canvas, hint, captionX, captionBaseline, captionPaint, e - captionStart)

        status?.let { canvas.drawText(it, (width - statusPaint.measureText(it)) / 2f, statusBaseline, statusPaint) }
        return e < drawing.durationMs || !captionDone
    }

    // ---------- результат ----------

    private fun drawResult(canvas: Canvas, now: Long, r: WeightResult): Boolean {
        val variant = boilVariant(now)
        val e = elapsed(resultStart, now)

        // Число и указатель плавно догоняют новую оценку.
        val dt = (now - lastFrameTime).coerceIn(0L, 100L)
        lastFrameTime = now
        val k = if (motionEnabled) 1.0 - exp(-dt / FOLLOW_TAU_MS) else 1.0
        shownWeight += (r.weightKg - shownWeight) * k
        shownCi += (r.confidenceIntervalKg - shownCi) * k
        val settling = abs(r.weightKg - shownWeight) > 0.05 || abs(r.confidenceIntervalKg - shownCi) > 0.05

        // Вес
        val number = "%.0f".format(shownWeight)
        val unit = resources.getString(R.string.unit_kg)
        val numberBaseline = pad + numberPaint.textSize * 0.9f
        val numberWidth = numberPaint.measureText(number)
        val gap = ink.dp(6f)
        val textEnd = pad + numberWidth + gap + unitPaint.measureText(unit)

        val tNumber = 0L
        writeText(canvas, number, pad, numberBaseline, numberPaint, e - tNumber)
        val numberDur = writeDuration(numberWidth)
        writeText(canvas, unit, pad + numberWidth + gap, numberBaseline, unitPaint, e - numberDur)
        val tUnder = numberDur + writeDuration(textEnd - pad - numberWidth)

        // Подчёркивание: перестраиваем, только если ширина заметно изменилась.
        val underlineY = numberBaseline + ink.dp(10f)
        if (underline == null || abs(underlineWidth - textEnd) > ink.dp(8f)) {
            underlineWidth = textEnd
            underline = InkDrawing(
                listOf(
                    InkStroke(
                        floatArrayOf(
                            pad - ink.dp(4f), underlineY + ink.dp(1.5f),
                            (pad + textEnd) / 2f, underlineY,
                            textEnd + ink.dp(10f), underlineY - ink.dp(2f)
                        ),
                        ink, seed = 501, weight = 1.15f
                    )
                ),
                ink
            )
        }
        val under = underline!!
        under.draw(canvas, inkPaint, variant, e - tUnder)

        // Подпись: интервал и метод
        val tMeta = tUnder + under.durationMs
        val method = resources.getString(
            if (r.method == "ml_regression") R.string.method_ml else R.string.method_formula
        )
        val meta = resources.getString(R.string.meta_line, shownCi, method)
        val metaBaseline = underlineY + ink.dp(24f)
        val metaDone = writeText(canvas, meta, pad, metaBaseline, metaPaint, e - tMeta)
        status?.let { canvas.drawText(it, pad, metaBaseline + ink.dp(20f), statusPaint) }

        // Шкала
        val rulerY = height - pad - ink.dp(22f)
        val x0 = pad + ink.dp(6f)
        val x1 = width - pad - ink.dp(6f)
        if (ruler == null || r.weightKg < rulerLo + RULER_MARGIN || r.weightKg > rulerLo + RULER_SPAN - RULER_MARGIN) {
            rulerLo = (floor((r.weightKg - RULER_SPAN / 2) / RULER_MAJOR) * RULER_MAJOR).coerceAtLeast(0.0)
            ruler = buildRuler(x0, x1, rulerY)
            marker = null
        }
        val rul = ruler!!
        rul.draw(canvas, inkPaint, variant, e - tMeta)
        val labelsVisible = e - tMeta > rul.durationMs / 2
        if (labelsVisible) {
            var v = rulerLo
            while (v <= rulerLo + RULER_SPAN + 0.1) {
                canvas.drawText("%.0f".format(v), xFor(v, x0, x1), rulerY + ink.dp(20f), tickPaint)
                v += RULER_MAJOR
            }
        }

        // Указатель и скобка интервала
        val tMarker = tMeta + rul.durationMs
        val wx = xFor(shownWeight, x0, x1)
        val ciL = xFor(shownWeight - shownCi, x0, x1).coerceAtLeast(x0)
        val ciR = xFor(shownWeight + shownCi, x0, x1).coerceAtMost(x1)
        val key = (wx.roundToInt().toLong() shl 32) or ((ciR - ciL).roundToInt().toLong() and 0xffffffffL)
        if (marker == null || key != markerKey) {
            markerKey = key
            marker = buildMarker(wx, ciL, ciR, rulerY)
        }
        val mark = marker!!
        mark.draw(canvas, inkPaint, variant, e - tMarker)

        return settling || !metaDone || e < tMarker + mark.durationMs
    }

    private fun xFor(v: Double, x0: Float, x1: Float): Float =
        x0 + ((v - rulerLo) / RULER_SPAN).toFloat() * (x1 - x0)

    private fun buildRuler(x0: Float, x1: Float, y: Float): InkDrawing {
        val strokes = ArrayList<InkStroke>()
        strokes += InkStroke(
            floatArrayOf(x0 - ink.dp(4f), y, (x0 + x1) / 2f, y + ink.dp(1f), x1 + ink.dp(4f), y - ink.dp(0.5f)),
            ink, seed = 610
        )
        var v = rulerLo
        var i = 0
        while (v <= rulerLo + RULER_SPAN + 0.1) {
            val x = xFor(v, x0, x1)
            val major = (v / RULER_MAJOR).roundToInt() * RULER_MAJOR == v
            val len = ink.dp(if (major) 8f else 4.5f)
            strokes += InkStroke(
                floatArrayOf(x, y - len / 2f, x + ink.dp(0.3f), y + len / 2f), ink,
                seed = 620 + i, weight = if (major) 0.9f else 0.7f,
                allowGaps = false, allowDouble = false
            )
            v += RULER_MINOR
            i++
        }
        return InkDrawing(strokes, ink, speedScale = 1.6f)
    }

    private fun buildMarker(wx: Float, ciL: Float, ciR: Float, y: Float): InkDrawing {
        val tip = y - ink.dp(6f)
        val top = tip - ink.dp(12f)
        val half = ink.dp(6f)
        val bracketY = top - ink.dp(8f)
        val foot = ink.dp(5f)
        val strokes = listOf(
            // Указатель — открытый треугольник, только контур
            InkStroke(
                floatArrayOf(wx - half, top, wx + half, top, wx, tip),
                ink, seed = 700, closed = true, allowGaps = false, allowDouble = false
            ),
            // Скобка доверительного интервала
            InkStroke(
                floatArrayOf(
                    ciL, bracketY + foot, ciL + ink.dp(0.5f), bracketY,
                    (ciL + ciR) / 2f, bracketY - ink.dp(0.8f),
                    ciR - ink.dp(0.5f), bracketY, ciR, bracketY + foot
                ),
                ink, seed = 710, weight = 0.85f, allowGaps = false
            )
        )
        return InkDrawing(strokes, ink, speedScale = 1.4f)
    }

    // ---------- текст ----------

    /** Текст появляется слева направо со скоростью письма. Возвращает true, когда дописан. */
    private fun writeText(canvas: Canvas, text: String, x: Float, baseline: Float, paint: TextPaint, elapsedMs: Long): Boolean {
        if (elapsedMs <= 0L) return false
        val w = paint.measureText(text)
        val p = (elapsedMs.toFloat() / writeDuration(w)).coerceAtMost(1f)
        if (p >= 1f) {
            canvas.drawText(text, x, baseline, paint)
            return true
        }
        val fm = paint.fontMetrics
        canvas.save()
        canvas.clipRect(x - ink.dp(2f), baseline + fm.top, x + w * p, baseline + fm.bottom)
        canvas.drawText(text, x, baseline, paint)
        canvas.restore()
        return false
    }

    private fun writeDuration(widthPx: Float): Long =
        (widthPx / ink.writeSpeed).toLong().coerceIn(150L, 1400L)

    private fun textPaint(sp: Float, face: Typeface, color: Int) = TextPaint(TextPaint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        typeface = face
        textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, resources.displayMetrics)
    }

    private fun fitTextSize(text: String, paint: TextPaint, sp: Float, maxWidth: Float): Float {
        var size = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, resources.displayMetrics)
        paint.textSize = size
        val w = paint.measureText(text)
        if (w > maxWidth) size *= maxWidth / w
        return size
    }

    private companion object {
        const val FOLLOW_TAU_MS = 220.0
        const val RULER_SPAN = 250.0
        const val RULER_MAJOR = 50.0
        const val RULER_MINOR = 25.0
        const val RULER_MARGIN = 30.0
    }
}
