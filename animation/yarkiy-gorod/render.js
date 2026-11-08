// Покадровый рендер index.html в JPEG-последовательность (детерминированный таймлайн).
// node render.js <outDir> [workers=3] [fps=60] [from] [to]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = process.argv[2] || 'frames', workers = +(process.argv[3] || 3), FPS = +(process.argv[4] || 60);
const total = 20 * FPS, from = +(process.argv[5] || 0), to = +(process.argv[6] || total);
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.resolve(__dirname, 'index.html') + '?export';
(async () => {
  const browser = await chromium.launch();
  const t0 = Date.now(); let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', e => console.error('pageerror', e.message));
    await page.goto(url); await page.evaluate(() => window.ready);
    for (let i = from + w; i < to; i += workers) {
      const file = path.join(out, `f${String(i).padStart(5, '0')}.jpg`);
      if (fs.existsSync(file)) { done++; continue; }
      const data = await page.evaluate(t => { renderAt(t, 1); return document.getElementById('c').toDataURL('image/jpeg', .96); }, i / FPS);
      fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
      if (++done % 60 === 0) console.log(`${done}/${to - from} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  }));
  await browser.close();
  console.log('done', done, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
})();
