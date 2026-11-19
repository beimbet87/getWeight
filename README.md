# GetWeight — бесконтактное взвешивание КРС по фото/видео (Android)

Прототип Android-приложения для оценки живой массы коров по фото/видео с
камеры смартфона, с целевой точностью **±10 кг**.

Полное техническое описание методологии, pipeline и анализа погрешностей —
в [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Технологический стек

- **Платформа**: Android (Kotlin, CameraX)
- **ML**: TensorFlow Lite (keypoint-модель позы КРС + ML-регрессор массы)
- **CV**: OpenCV Android SDK (ArUco-калибровка масштаба)
- **Опционально**: ARCore Depth API / ToF для оценки глубины грудной клетки

## Структура репозитория

```
app/                              — Android-приложение
  src/main/java/com/getweight/cv/
    camera/        — CameraX ImageAnalysis, конвертация YUV → Bitmap
    calibration/   — ArUco-калибровка px → см
    pose/          — валидация ракурса/позы животного
    ml/            — TFLite-инференс ключевых точек
    morphometry/   — расчёт промеров и веса (формулы + ML-регрессия)
    filter/        — фильтр Калмана для сглаживания серии оценок
    pipeline/       — оркестрация полного конвейера обработки кадра
    model/         — доменные модели данных
  src/main/assets/models/ — демо/заглушки .tflite моделей (см. README там и ниже)
python/
  generate_synthetic_dataset.py       — генерация синтетических обучающих
                                         данных для регрессора (демо, не
                                         реальные взвешивания)
  generate_placeholder_keypoint_model.py — генерация keypoint-заглушки
  train_weight_regressor.py           — обучение и экспорт ML-регрессора
                                         массы в TFLite
  sample_data/cattle_weight_dataset_synthetic.csv — пример сгенерированного
                                         датасета (формат для реальных данных)
docs/
  ARCHITECTURE.md — полное техническое описание архитектуры и методологии
```

## Важно: модели — демо/заглушки, не production-веса

Прототип содержит полную логику конвейера (калибровка, валидация, промеры,
формулы, фильтрация) и **включает две TFLite-модели**, но обе требуют
переобучения на реальных данных перед промышленным использованием:

- `cattle_keypoints_fp16.tflite` — **заглушка**: всегда возвращает
  confidence=0.0, поэтому `PoseValidator` отбраковывает каждый кадр. Это
  безопасное поведение по умолчанию — приложение не может показать
  вес, посчитанный на фиктивных ключевых точках, пока модель не обучена на
  реальных фото КРС.
- `weight_regressor_fp16.tflite` — обучена на **синтетических** данных
  (`python/generate_synthetic_dataset.py`), демонстрирует работающий
  пайплайн обучения/экспорта/инференса, но не данные реального стада.

Подробности и шаги для замены на production-модели — в
`app/src/main/assets/models/README.md` и `docs/ARCHITECTURE.md`, раздел 4.4.

## Сборка

Проект использует Gradle Kotlin DSL, Gradle wrapper включён (версия 8.7,
совместима с Android Gradle Plugin 8.5.2). OpenCV Android AAR подключается
через Maven Central (`org.opencv:opencv:4.10.0`), остальные зависимости
(AGP, AndroidX/CameraX, ARCore) — через Google Maven (`google()` в
`settings.gradle.kts`). Откройте корень репозитория в Android Studio
(Koala+) и синхронизируйте Gradle — для первой синхронизации нужен обычный
доступ в интернет к `dl.google.com` и `services.gradle.org`.

Что было проверено явно (не только "похоже на правильный код"):
- API ArUco-детекции сверено по реальному содержимому `opencv-4.10.0.aar`
  (`javap` по его `classes.jar`) — старый пакет `org.opencv.aruco.*`
  отсутствует в этой версии, используется новый `org.opencv.objdetect.*`
  (`ArucoDetector`/`Objdetect`), код в `ArucoCalibrator.kt` уже обновлён.
- Обе `.tflite`-модели (keypoint-заглушка и регрессор) реально
  сгенерированы/обучены в этом окружении и проверены инференсом через
  `tf.lite.Interpreter` — формы входа/выхода совпадают с тем, что ожидает
  `KeypointDetector.kt`/`WeightEstimator.kt`.
- `OpenCVLoader.initLocal()` добавлен в `MainActivity` — без него любой
  вызов OpenCV (детекция маркера, `cvtColor`, `bitmapToMat`) завершится
  `UnsatisfiedLinkError`, так как AAR не грузит свою `.so`-библиотеку сам.
- Ресурсы иконки приложения (`@mipmap/ic_launcher`), на которые ссылался
  манифест, были добавлены (adaptive icon) — без них aapt2 не слинковал бы
  ресурсы.

Чего **не удалось** проверить в этой среде: полную компиляцию
`./gradlew assembleDebug` — песочница этого инструмента блокирует сетевой
доступ к `dl.google.com` (политика сети), откуда резолвятся сам Android
Gradle Plugin, AndroidX/CameraX и ARCore. Это ограничение именно этой
изолированной среды, а не вашей машины — при обычном доступе в интернет в
Android Studio эти зависимости резолвятся штатно. Если при синхронизации
в вашей Android Studio всё же появится ошибка — пришлите текст ошибки,
поправим точечно.
