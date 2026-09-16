package com.getweight.cv.calibration

import org.opencv.aruco.Aruco
import org.opencv.aruco.DetectorParameters
import org.opencv.aruco.Dictionary
import org.opencv.core.Mat
import org.opencv.core.MatOfInt
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point

/**
 * Пиксель→см калибровка через ArUco-маркер известного физического размера,
 * размещённый в одной плоскости с телом животного (на земле, перпендикулярно
 * оси камеры). Это устраняет ошибку масштабирования от неизвестной/переменной
 * дистанции до объекта: масштаб вычисляется локально, по видимому размеру
 * маркера в конкретном кадре, а не через допущение о фиксированном расстоянии
 * камера-животное (см. docs/ARCHITECTURE.md, раздел 1.3).
 */
class ArucoCalibrator(
    private val markerLengthCm: Double = 50.0,
    dictionaryId: Int = Aruco.DICT_5X5_100
) {

    /**
     * @param pixelsPerCm масштаб для перевода пиксельных расстояний в см.
     * @param markerCornersPx углы обнаруженного маркера в пикселях кадра.
     * @param cameraTiltDeg оценка отклонения плоскости маркера (≈ плоскости
     *   тела животного) от строгой перпендикулярности к оптической оси камеры.
     *   Используется PoseValidator'ом для отбраковки перекошенных кадров.
     */
    data class CalibrationResult(
        val pixelsPerCm: Double,
        val markerCornersPx: MatOfPoint2f,
        val cameraTiltDeg: Double
    )

    private val dictionary: Dictionary = Aruco.getPredefinedDictionary(dictionaryId)
    private val params: DetectorParameters = DetectorParameters.create()

    fun detect(frameGray: Mat): CalibrationResult? {
        val corners = ArrayList<Mat>()
        val ids = MatOfInt()
        Aruco.detectMarkers(frameGray, dictionary, corners, ids, params)

        if (corners.isEmpty()) return null

        val marker = MatOfPoint2f(corners[0])
        val pts = marker.toArray()
        if (pts.size < 4) return null

        // Средняя длина противоположных сторон маркера в пикселях — частично
        // компенсирует небольшой остаточный перспективный перекос за счёт
        // усреднения, а не измерения одной случайно выбранной стороны.
        val side1 = distance(pts[0], pts[1])
        val side2 = distance(pts[2], pts[3])
        val side3 = distance(pts[1], pts[2])
        val side4 = distance(pts[3], pts[0])

        val horizontalPx = (side1 + side2) / 2.0
        val verticalPx = (side3 + side4) / 2.0

        // Расхождение между смежными сторонами маркера — индикатор того, что
        // его плоскость не строго перпендикулярна оси камеры.
        val skewRatio = maxOf(horizontalPx, verticalPx) / minOf(horizontalPx, verticalPx).coerceAtLeast(1e-6)
        val tiltDeg = Math.toDegrees(Math.acos((1.0 / skewRatio).coerceIn(-1.0, 1.0)))

        val avgSidePx = (horizontalPx + verticalPx) / 2.0
        val pixelsPerCm = avgSidePx / markerLengthCm

        return CalibrationResult(pixelsPerCm, marker, tiltDeg)
    }

    private fun distance(a: Point, b: Point): Double {
        val dx = a.x - b.x
        val dy = a.y - b.y
        return Math.sqrt(dx * dx + dy * dy)
    }
}
