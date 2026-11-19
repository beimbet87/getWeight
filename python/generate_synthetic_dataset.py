"""
Генерация СИНТЕТИЧЕСКОГО датасета для демонстрационного обучения
ML-регрессора массы (`train_weight_regressor.py`).

ВАЖНО, прочитать перед использованием:

Это НЕ данные реальных взвешиваний КРС. Это модельно сгенерированные пары
"промеры <-> вес", построенные из зоотехнической зависимости (обратная
формула Трухановского) с добавлением реалистичного шума, имитирующего:
  - индивидуальную изменчивость телосложения внутри одной породной группы;
  - погрешность фото-метода измерения (калибровка маркера, детекция
    ключевых точек) порядка 1-2% на промер;
  - разброс соотношений "высота в холке / ширина / глубина груди" от
    косой длины и обхвата груди.

Назначение этого датасета — ТОЛЬКО продемонстрировать работающий сквозной
пайплайн обучения -> экспорта в TFLite -> инференса на Android
(WeightEstimator.kt). Модель, обученная на этих данных, НЕ готова к
промышленному использованию и не подтверждает точность ±10 кг на реальных
животных — она должна быть переобучена на реальных контрольных
взвешиваниях конкретной фермы/породы перед развёртыванием. См.
docs/ARCHITECTURE.md, раздел 4.4.
"""

import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)
N = 4000

BREED_CONDITION_K_VALUES = [1.85, 2.00, 2.20, 2.50]


def main(out_path: str = "cattle_weight_dataset_synthetic.csv") -> None:
    k = RNG.choice(BREED_CONDITION_K_VALUES, size=N)
    true_weight = RNG.uniform(420, 750, size=N)

    # "Истинная" зоотехническая зависимость обхвата груди от массы и типа
    # животного — инверсия формулы Трухановского (W = G^2 * L * K / 100)
    # при разумном отношении длины тела к обхвату груди (~0.80-0.86 для
    # взрослого КРС), плюс индивидуальный био-шум телосложения.
    length_to_girth_ratio = 0.80 + RNG.normal(0, 0.03, size=N)
    heart_girth = np.sqrt((true_weight * 100.0) / (k * length_to_girth_ratio))
    oblique_length = heart_girth * length_to_girth_ratio

    withers_height = 0.72 * oblique_length + RNG.normal(0, 2.5, size=N)
    body_width = 0.30 * heart_girth + RNG.normal(0, 1.5, size=N)
    body_depth = 0.86 * body_width + RNG.normal(0, 1.2, size=N)

    # Измерительный шум фото-метода: остаточная ошибка калибровки маркера и
    # детекции ключевых точек (±1.0-1.5% на обхват/длину).
    heart_girth_measured = heart_girth * (1 + RNG.normal(0, 0.015, size=N))
    oblique_length_measured = oblique_length * (1 + RNG.normal(0, 0.012, size=N))

    df = pd.DataFrame(
        {
            "heart_girth_cm": heart_girth_measured,
            "oblique_length_cm": oblique_length_measured,
            "withers_height_cm": withers_height,
            "body_depth_cm": body_depth,
            "body_width_cm": body_width,
            "breed_condition_k": k,
            "actual_weight_kg": true_weight,
        }
    )
    df.to_csv(out_path, index=False)
    print(f"Saved {len(df)} synthetic rows to {out_path}")


if __name__ == "__main__":
    main()
