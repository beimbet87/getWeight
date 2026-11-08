package com.getweight.cv.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PointF
import android.graphics.RectF
import android.util.AttributeSet
import com.getweight.cv.R
import com.getweight.cv.model.BodyLandmark
import com.getweight.cv.model.Keypoint
import com.getweight.cv.ui.ink.InkDrawing
import com.getweight.cv.ui.ink.InkStroke
import com.getweight.cv.ui.ink.InkView
import kotlin.math.abs
import kotlin.math.max
import kotlin.random.Random

/**
 * Слой поверх превью камеры: рамка, нарисованная пером вокруг кадра, и
 * скелет ключевых точек животного тем же пером. Под линиями скелета —
 * узкий ореол цвета бумаги, чтобы тушь читалась на тёмной шерсти.
 *
 * Превью камеры должно занимать область с отступом
 * [R.dimen.ink_frame_inset] от краёв этого слоя.
 */
class InkCameraOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : InkView(context, attrs) {

    private val inset = resources.getDimension(R.dimen.ink_frame_inset)
    private val previewRect = RectF()

    private var frame: InkDrawing? = null
    private var frameStart = 0L

    private val haloPaint = Paint(inkPaint).apply { color = ink.paper }
    private val haloExtra = ink.dp(2.5f)

    private val target = HashMap<BodyLandmark, PointF>()
    private val current = HashMap<BodyLandmark, PointF>()
    private var skeleton: InkDrawing? = null
    private var skeletonStart = 0L
    private var lastSeen = 0L
    private var lastTick = -1L

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        previewRect.set(inset, inset, w - inset, h - inset)
        frame = buildFrame()
        frameStart = now()
        skeleton = null
    }

    /**
     * Обновить ключевые точки текущего кадра.
     * @param frameWidth ширина/высота кадра анализа (до поворота).
     * @param rotationDegrees поворот кадра относительно экрана.
     */
    fun showKeypoints(
        keypoints: Map<BodyLandmark, Keypoint>?,
        frameWidth: Int,
        frameHeight: Int,
        rotationDegrees: Int
    ) {
        if (keypoints != null && !previewRect.isEmpty) {
            val t = now()
            target.clear()
            for ((landmark, kp) in keypoints) {
                if (kp.confidence >= MIN_CONFIDENCE) {
                    target[landmark] = mapToView(kp.xPx, kp.yPx, frameWidth, frameHeight, rotationDegrees)
                }
            }
            if (current.isEmpty() || t - lastSeen > HIDE_AFTER_MS) {
                // Скелет появляется заново — прорисовываем его пером с начала.
                current.clear()
                target.forEach { (k, p) -> current[k] = PointF(p.x, p.y) }
                skeleton = null
                skeletonStart = t
            }
            lastSeen = t
        }
        invalidate()
    }

    override fun drawInk(canvas: Canvas, now: Long): Boolean {
        val variant = boilVariant(now)
        var revealing = false

        frame?.let {
            val e = elapsed(frameStart, now)
            it.draw(canvas, inkPaint, variant, e)
            revealing = e < it.durationMs
        }

        if (current.isEmpty()) return revealing
        if (now - lastSeen > HIDE_AFTER_MS) {
            current.clear()
            skeleton = null
            return revealing
        }

        // Точки догоняют цель шагами кипения — движение мягкое и в такт линии.
        val tick = now / ink.boilIntervalMs
        if (tick != lastTick) {
            lastTick = tick
            if (smoothTowardsTarget()) skeleton = null
        }
        val drawing = skeleton ?: buildSkeleton().also { skeleton = it }

        val e = elapsed(skeletonStart, now)
        canvas.save()
        canvas.clipRect(previewRect)
        drawing.draw(canvas, haloPaint, variant, e, haloExtra)
        drawing.draw(canvas, inkPaint, variant, e)
        canvas.restore()
        return revealing || e < drawing.durationMs
    }

    private fun smoothTowardsTarget(): Boolean {
        var moved = false
        for ((k, p) in current) {
            val t = target[k] ?: continue
            val dx = (t.x - p.x) * FOLLOW
            val dy = (t.y - p.y) * FOLLOW
            if (abs(dx) > 0.3f || abs(dy) > 0.3f) {
                p.x += dx
                p.y += dy
                moved = true
            }
        }
        // Точки, пропавшие из кадра, убираем; новые — добавляем на месте.
        if (current.keys.retainAll(target.keys)) moved = true
        for ((k, t) in target) {
            if (k !in current) {
                current[k] = PointF(t.x, t.y)
                moved = true
            }
        }
        return moved
    }

    private fun buildSkeleton(): InkDrawing {
        val strokes = ArrayList<InkStroke>()
        BONES.forEachIndexed { i, (a, b) ->
            val pa = current[a] ?: return@forEachIndexed
            val pb = current[b] ?: return@forEachIndexed
            val mx = (pa.x + pb.x) / 2f
            val my = (pa.y + pb.y) / 2f
            strokes += InkStroke(
                floatArrayOf(pa.x, pa.y, mx, my, pb.x, pb.y), ink,
                seed = 900 + i * 31, weight = 0.9f, allowGaps = false
            )
        }
        val r = ink.dp(3.5f)
        for ((landmark, p) in current) {
            val pts = FloatArray(12)
            for (k in 0 until 6) {
                val a = k / 6.0 * 2.0 * Math.PI
                pts[2 * k] = p.x + r * kotlin.math.cos(a).toFloat()
                pts[2 * k + 1] = p.y + r * kotlin.math.sin(a).toFloat()
            }
            strokes += InkStroke(
                pts, ink, seed = 1700 + landmark.ordinal * 13, closed = true,
                weight = 0.8f, allowGaps = false, allowDouble = false
            )
        }
        return InkDrawing(strokes, ink, speedScale = 2.5f)
    }

    /** Рамка из четырёх штрихов с перехлёстом в углах, как от руки. */
    private fun buildFrame(): InkDrawing {
        val gap = ink.dp(5f)
        val l = previewRect.left - gap
        val t = previewRect.top - gap
        val r = previewRect.right + gap
        val b = previewRect.bottom + gap
        val rnd = Random(42)
        fun j() = (rnd.nextFloat() - 0.5f) * ink.dp(3f)
        val o = ink.dp(6f)
        val sides = listOf(
            floatArrayOf(l - o * 0.5f, t + j(), (l + r) / 2f, t + j(), r + o, t + j()),
            floatArrayOf(r + j(), t - o, r + j(), (t + b) / 2f, r + j(), b + o * 0.7f),
            floatArrayOf(r + o * 0.6f, b + j(), (l + r) / 2f, b + j(), l - o, b + j()),
            floatArrayOf(l + j(), b + o * 0.5f, l + j(), (t + b) / 2f, l + j(), t - o)
        )
        return InkDrawing(sides.mapIndexed { i, p -> InkStroke(p, ink, seed = 300 + i * 7) }, ink)
    }

    private fun mapToView(x: Float, y: Float, fw: Int, fh: Int, rotation: Int): PointF {
        val rx: Float
        val ry: Float
        val rw: Float
        val rh: Float
        when (rotation) {
            90 -> { rx = fh - y; ry = x; rw = fh.toFloat(); rh = fw.toFloat() }
            180 -> { rx = fw - x; ry = fh - y; rw = fw.toFloat(); rh = fh.toFloat() }
            270 -> { rx = y; ry = fw - x; rw = fh.toFloat(); rh = fw.toFloat() }
            else -> { rx = x; ry = y; rw = fw.toFloat(); rh = fh.toFloat() }
        }
        // PreviewView по умолчанию — FILL_CENTER: масштаб «заполнить», центр.
        val scale = max(previewRect.width() / rw, previewRect.height() / rh)
        val ox = previewRect.left + (previewRect.width() - rw * scale) / 2f
        val oy = previewRect.top + (previewRect.height() - rh * scale) / 2f
        return PointF(ox + rx * scale, oy + ry * scale)
    }

    private companion object {
        const val MIN_CONFIDENCE = 0.3f
        const val HIDE_AFTER_MS = 700L
        const val FOLLOW = 0.55f

        val BONES = listOf(
            BodyLandmark.NOSE to BodyLandmark.SHOULDER_JOINT,
            BodyLandmark.SHOULDER_JOINT to BodyLandmark.WITHERS,
            BodyLandmark.WITHERS to BodyLandmark.HOOK_BONE,
            BodyLandmark.HOOK_BONE to BodyLandmark.TAIL_HEAD,
            BodyLandmark.TAIL_HEAD to BodyLandmark.ISCHIAL_TUBEROSITY,
            BodyLandmark.SHOULDER_JOINT to BodyLandmark.ISCHIAL_TUBEROSITY,
            BodyLandmark.CHEST_TOP to BodyLandmark.CHEST_FLOOR,
            BodyLandmark.SHOULDER_JOINT to BodyLandmark.FRONT_HOOF_FRONT,
            BodyLandmark.FRONT_HOOF_FRONT to BodyLandmark.FRONT_HOOF_REAR,
            BodyLandmark.ISCHIAL_TUBEROSITY to BodyLandmark.REAR_HOOF_REAR,
            BodyLandmark.REAR_HOOF_REAR to BodyLandmark.REAR_HOOF_FRONT
        )
    }
}
