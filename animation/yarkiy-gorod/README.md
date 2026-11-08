# «Яркий город» — анимация 20 с

Эластичный шарик перепрыгивает стену «НЕЛЬЗЯ» и возвращает краски серому городу.

- `yarkiy-gorod.mp4` — готовое видео: 1920×1080, 60 fps, H.264 yuv420p, звук AAC 48 кГц.
- `index.html` — исходник анимации (Canvas + собственный таймлайн); откройте рядом с `soundtrack.m4a`
  и нажмите «Смотреть со звуком». Превью рисуется без размытия; полное качество — в MP4.
- `STORYBOARD.md` — идея, варианты сцен, раскадровка и журнал проверки.
- `music.py` — синтез саундтрека (numpy); `render.js` — покадровый рендер (Playwright);
  `build.sh` — сборка MP4 через FFmpeg.

Пересборка: `node render.js frames 3 && bash build.sh frames yarkiy-gorod.mp4`.
Шрифт Unbounded — SIL Open Font License.
