# Модели

Сюда должны быть помещены обученные TFLite-модели:

- `cattle_keypoints_fp16.tflite` — модель ключевых точек тела КРС
  (см. `ml/KeypointDetector.kt`). Вход: RGB 256×256. Выход:
  `[1, N, 3]` (x, y, confidence) в нормализованных координатах,
  `N = BodyLandmark.values().size`.
- `weight_regressor_fp16.tflite` — регрессор массы поверх зоотехнических
  признаков (см. `morphometry/WeightEstimator.kt` и
  `python/train_weight_regressor.py`). Вход: `[1, 6]` float32. Выход: `[1, 1]`
  float32 (кг).

Модели не включены в репозиторий — они требуют размеченного датасета КРС
(ключевые точки) и контрольных взвешиваний (регрессор). См.
`docs/ARCHITECTURE.md`, раздел 4.4, о деградации системы без этих моделей.
