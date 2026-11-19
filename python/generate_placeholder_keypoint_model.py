"""
Создаёт ЗАГЛУШКУ (placeholder) TFLite-модели ключевых точек тела КРС,
используемую `KeypointDetector.kt`.

ВАЖНО, прочитать перед использованием:

Эта модель НЕ обучена на реальных изображениях КРС и НЕ умеет находить
анатомические точки. Она детерминированно возвращает координаты центра
кадра (x=0.5, y=0.5) и confidence=0.0 для каждой из 12 ключевых точек,
независимо от входного изображения.

Назначение заглушки — чтобы Android-приложение можно было собрать и
запустить целиком (камера -> калибровка -> инференс -> валидация позы ->
UI), не падая из-за отсутствия файла модели. Поскольку confidence всегда
0.0, а порог `PoseValidator.minKeypointConfidence` = 0.55, КАЖДЫЙ кадр
будет честно отбракован ("Кадр отбракован...") — приложение никогда не
покажет пользователю вес, рассчитанный на фиктивных ключевых точках.

Перед реальным использованием эта модель должна быть заменена на
настоящую, обученную на размеченном датасете фотографий КРС (архитектура
в духе YOLOv8-pose/MoveNet, вход 256x256 RGB uint8, выход [1, 12, 3]) —
см. docs/ARCHITECTURE.md, разделы 1.2 и 3.
"""

import numpy as np
import tensorflow as tf

NUM_LANDMARKS = 12  # должно совпадать с BodyLandmark.values().size в Kotlin
INPUT_SIZE = 256


class PlaceholderKeypointModel(tf.Module):
    def __init__(self):
        super().__init__()
        # (x=0.5, y=0.5, confidence=0.0) для каждой ключевой точки.
        constant_output = np.tile(
            np.array([0.5, 0.5, 0.0], dtype=np.float32), (NUM_LANDMARKS, 1)
        ).reshape(1, NUM_LANDMARKS, 3)
        self._output_const = tf.constant(constant_output)

    @tf.function(
        input_signature=[
            tf.TensorSpec(shape=[1, INPUT_SIZE, INPUT_SIZE, 3], dtype=tf.uint8)
        ]
    )
    def __call__(self, image):
        # Вход игнорируется полностью — это заглушка, см. докстринг модуля.
        batch = tf.shape(image)[0]
        return tf.tile(self._output_const, [batch, 1, 1])


def main(out_path: str = "cattle_keypoints_fp16.tflite") -> None:
    module = PlaceholderKeypointModel()
    concrete_func = module.__call__.get_concrete_function()
    converter = tf.lite.TFLiteConverter.from_concrete_functions([concrete_func], module)
    tflite_model = converter.convert()
    with open(out_path, "wb") as f:
        f.write(tflite_model)
    print(f"Saved placeholder keypoint model to {out_path}")


if __name__ == "__main__":
    main()
