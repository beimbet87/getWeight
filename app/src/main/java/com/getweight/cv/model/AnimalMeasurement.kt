package com.getweight.cv.model

/**
 * Зоотехнические промеры одного животного, вычисленные по одному кадру
 * (в сантиметрах, после применения px→см калибровки).
 */
data class AnimalMeasurement(
    val obliqueBodyLengthCm: Double, // косая длина туловища
    val heartGirthCm: Double,        // обхват груди (эллиптическая аппроксимация)
    val withersHeightCm: Double,     // высота в холке
    val bodyDepthCm: Double,         // глубина груди (переднезадний размер)
    val bodyWidthCm: Double,         // ширина груди в проекции кадра
    val frameConfidence: Float       // средняя уверенность модели ключевых точек
)
