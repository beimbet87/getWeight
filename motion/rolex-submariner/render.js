// Usage: node render.js <outDir> <from> <to> [step]   -> writes JPEG frames f_XXXXX.jpg (frame index i, time i/60)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [outDir, from, to, step = 1] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForFunction('window.ready', null, { timeout: 120000 });
  const list = from === 'list' ? to.split(',').map(Number) : Array.from({ length: Math.ceil((+to - +from) / +step) }, (_, k) => +from + k * +step);
  for (const i of list) {
    const fn = `${outDir}/f_${String(i).padStart(5, '0')}.jpg`;
    if (fs.existsSync(fn)) continue;
    const data = await p.evaluate(i => { renderAt(i / 60); return document.getElementById('c').toDataURL('image/jpeg', 0.95); }, i);
    fs.writeFileSync(fn, Buffer.from(data.split(',')[1], 'base64'));
  }
  await b.close();
})();
