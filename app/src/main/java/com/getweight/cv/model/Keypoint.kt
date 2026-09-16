package com.getweight.cv.model

/**
 * Анатомическая ключевая точка тела КРС, извлечённая моделью позы.
 * Координаты — в пикселях исходного кадра, confidence — в [0, 1].
 */
data class Keypoint(
    val name: BodyLandmark,
    val xPx: Float,
    val yPx: Float,
    val confidence: Float
)

/**
 * Набор ключевых точек, используемых для расчёта зоотехнических промеров.
 * Названия соответствуют русской зоотехнической терминологии (см.
 * docs/ARCHITECTURE.md, раздел 1.4).
 */
enum class BodyLandmark {
    WITHERS,             // холка
    SHOULDER_JOINT,      // плечелопаточное сочленение
    ISCHIAL_TUBEROSITY,  // седалищный бугор
    HOOK_BONE,           // маклок
    CHEST_FLOOR,         // нижняя точка груди за лопатками
    CHEST_TOP,           // верхняя точка груди, вертикально над CHEST_FLOOR
    FRONT_HOOF_FRONT,
    FRONT_HOOF_REAR,
    REAR_HOOF_FRONT,
    REAR_HOOF_REAR,
    NOSE,
    TAIL_HEAD
}
