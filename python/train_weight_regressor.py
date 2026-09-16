"""
Референсный скрипт обучения и экспорта ML-регрессора живой массы КРС.

Назначение: обучить лёгкую модель, которая корректирует систематическое
смещение классических зоотехнических формул (Трухановского, Клювера-Штрауха)
относительно РЕАЛЬНОГО веса животного (с контрольных весов). Это ключевой
компонент для достижения точности ±10 кг — см. docs/ARCHITECTURE.md,
разделы 1.1 и 4.4.

Обучение выполняется отдельно (сервер/ноутбук), не на телефоне. Результат —
файл `weight_regressor_fp16.tflite`, который кладётся в
`app/src/main/assets/models/` и используется `WeightEstimator.kt`.

Требуемый формат обучающего датасета (CSV), одна строка = одно валидное
измерение (кадр, прошедший PoseValidator):

    heart_girth_cm, oblique_length_cm, withers_height_cm, body_depth_cm,
    body_width_cm, breed_condition_k, actual_weight_kg

`actual_weight_kg` — контрольное взвешивание животного на весах в тот же
день (в идеале — в течение нескольких часов от съёмки, натощак, см. раздел
4.2 про наполненность рубца).

Этот скрипт — иллюстративный шаблон, а не готовый production-пайплайн: перед
использованием нужен реальный размеченный датасет конкретной фермы/породы.
"""

import argparse

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

FEATURE_COLUMNS = [
    "heart_girth_cm",
    "oblique_length_cm",
    "withers_height_cm",
    "body_depth_cm",
    "body_width_cm",
    "breed_condition_k",
]
TARGET_COLUMN = "actual_weight_kg"


def build_model(input_dim: int) -> tf.keras.Model:
    """Небольшой MLP: цель — минимальная модель, которая уверенно
    инферится на мобильном устройстве (<50 KB после квантизации), а не
    максимальная точность на обучающей выборке."""
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1),
        ]
    )
    model.compile(optimizer="adam", loss="mae", metrics=["mae"])
    return model


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True, help="Путь к CSV с обучающими данными")
    parser.add_argument("--epochs", type=int, default=200)
    parser.add_argument(
        "--out",
        default="weight_regressor_fp16.tflite",
        help="Путь для сохранения экспортированной TFLite-модели",
    )
    args = parser.parse_args()

    df = pd.read_csv(args.data)
    missing = set(FEATURE_COLUMNS + [TARGET_COLUMN]) - set(df.columns)
    if missing:
        raise ValueError(f"В датасете отсутствуют колонки: {missing}")

    X = df[FEATURE_COLUMNS].to_numpy(dtype=np.float32)
    y = df[TARGET_COLUMN].to_numpy(dtype=np.float32)

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    # Масштабирование признаков фиксируется на train-выборке и переносится в
    # граф модели (Normalization-слой), чтобы на телефоне не нужно было
    # повторно реализовывать препроцессинг — TFLite-модель принимает "сырые"
    # промеры в см напрямую.
    scaler = StandardScaler().fit(X_train)

    normalization = tf.keras.layers.Normalization(axis=-1)
    normalization.adapt(X_train)

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(len(FEATURE_COLUMNS),)),
            normalization,
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1),
        ]
    )
    model.compile(optimizer="adam", loss="mae", metrics=["mae"])

    model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=16,
        verbose=2,
    )

    val_mae = model.evaluate(X_val, y_val, verbose=0)[1]
    print(f"Validation MAE: {val_mae:.2f} kg")
    if val_mae > 10.0:
        print(
            "ПРЕДУПРЕЖДЕНИЕ: MAE на валидации превышает целевые ±10 кг. "
            "Нужны больше/лучше данных, дополнительные признаки (BCS, порода, "
            "сезон) или пересмотр протокола съёмки перед развёртыванием."
        )

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    tflite_model = converter.convert()

    with open(args.out, "wb") as f:
        f.write(tflite_model)
    print(f"Сохранено: {args.out}")


if __name__ == "__main__":
    main()
