// لقطات الشاشات التمثيلية قبل مراجعة الواجهة وبعد كل دفعة تنفيذ.
//   node scripts/shots.mjs <تسمية الدفعة>          (الخادمان يعملان محليًا)
//   SHOTS_EMAIL / SHOTS_PASSWORD  حساب تجريبي محلي؛ بدونه تُلتقط الصفحات العامة فقط
// الناتج: shots/<الدفعة>/<الشاشة>--<العرض>--<الوضع>--<اللغة>.png
// تحتاج Google Chrome مثبّتًا (يُشغَّل بلا واجهة عبر CDP؛ لا اعتماد على مكتبة).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3001';
const LABEL = process.argv[2] ?? 'current';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EMAIL = process.env.SHOTS_EMAIL;
const PASSWORD = process.env.SHOTS_PASSWORD;
const PORT = Number(process.env.CDP_PORT ?? 9611);

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false, scale: 1 },
  { name: 'mobile-390', width: 390, height: 844, mobile: true, scale: 2 },
];
const SCHEMES = ['light', 'dark'];

/** [الاسم، المسار، يحتاج دخولًا، الأحجام، الأوضاع] */
const SCREENS = [
  ['site-home', '/ar', false, ['desktop-1440', 'mobile-390'], ['light', 'dark']],
  ['site-projects', '/ar/projects', false, ['desktop-1440', 'mobile-390'], ['light']],
  ['site-project', '/ar/projects/eust-academic-platform', false, ['desktop-1440'], ['light']],
  ['site-services', '/ar/services', false, ['desktop-1440', 'mobile-390'], ['light']],
  ['site-solutions', '/ar/solutions', false, ['desktop-1440'], ['light']],
  ['site-contact', '/ar/contact', false, ['desktop-1440'], ['light']],
  ['site-track', '/ar/track', false, ['desktop-1440'], ['light']],
  ['dash-home', '/dashboard', true, ['desktop-1440'], ['light', 'dark']],
  ['dash-projects', '/dashboard/content/projects', true, ['desktop-1440'], ['light']],
  ['dash-analytics', '/dashboard/analytics', true, ['desktop-1440'], ['light']],
  ['dash-requests', '/dashboard/crm/requests', true, ['desktop-1440'], ['light']],
  ['dash-sections', '/dashboard/content/home', true, ['desktop-1440'], ['light']],
  ['dash-settings', '/dashboard/settings', true, ['desktop-1440'], ['light']],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = join(tmpdir(), `shots-${Date.now()}`);
// Chrome الكامل أو chrome-headless-shell (الأخير لا يقبل --headless=new)
const headlessFlag = CHROME.includes('headless-shell') ? [] : ['--headless=new'];
const chrome = spawn(
  CHROME,
  [...headlessFlag, '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`, '--no-first-run', '--lang=ar', 'about:blank'],
  { stdio: 'ignore' },
);
chrome.on('exit', (code, sig) => console.error(`chrome exited: code=${code} signal=${sig}`));
let version;
for (let i = 0; i < 50 && !version; i++) {
  try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); }
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('close', () => { console.error('CDP socket closed'); process.exit(2); });
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq;
  const timer = setTimeout(() => reject(new Error(`${method}: timeout`)), 120000);
  pending.set(id, (m) => (clearTimeout(timer), m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});

const outDir = join('shots', LABEL);
mkdirSync(outDir, { recursive: true });
const done = [];
const skipped = [];

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const s = (m, p) => send(m, p, sessionId);
await s('Page.enable');
await s('Network.enable');

async function waitReady() {
  for (let i = 0; i < 80; i++) {
    const { result } = await s('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    if (result.value === 'complete') return;
    await sleep(250);
  }
}

// تسجيل الدخول مرة واحدة من Node (بلا Origin، فلا يعترضه فحص CSRF المحلي) ثم
// حقن الكوكيز في المتصفح: تبقى لباقي اللقطات
let loggedIn = false;
if (EMAIL && PASSWORD) {
  const response = await fetch(`${BASE}/api/v1/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  loggedIn = response.status === 200;
  if (loggedIn) {
    const host = new URL(BASE).hostname;
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';').map((x) => x.trim());
      const eq = pair.indexOf('=');
      const cookie = { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: host, path: '/' };
      for (const attr of attrs) {
        if (attr.toLowerCase() === 'httponly') cookie.httpOnly = true;
        if (attr.toLowerCase().startsWith('path=')) cookie.path = attr.slice(5);
      }
      await s('Network.setCookie', cookie);
    }
  }
  console.log('login:', loggedIn ? 'ok' : `failed (${response.status})`);
}

for (const [name, path, auth, vps, schemes] of SCREENS) {
  if (auth && !loggedIn) { skipped.push(`${name} (يحتاج دخولًا)`); continue; }
  for (const vp of VIEWPORTS.filter((v) => vps.includes(v.name))) {
    for (const scheme of schemes) {
      // استئناف: لقطة التقطت سابقًا في الدفعة نفسها لا تُعاد (احذف المجلد لإعادة الدفعة)
      if (existsSync(join(outDir, `${name}--${vp.name}--${scheme}--ar.png`))) continue;
      await s('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: vp.scale, mobile: vp.mobile });
      await s('Emulation.setEmulatedMedia', { features: [
        { name: 'prefers-color-scheme', value: scheme },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ] });
      await s('Page.navigate', { url: `${BASE}${path}` });
      await waitReady();
      await sleep(3000);
      const { result } = await s('Runtime.evaluate', {
        expression: 'Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)', returnByValue: true,
      });
      const height = Math.min(result.value, vp.mobile ? 5000 : 3600);
      await s('Emulation.setDeviceMetricsOverride', { width: vp.width, height, deviceScaleFactor: vp.scale, mobile: vp.mobile });
      await sleep(900);
      const shot = await s('Page.captureScreenshot', { format: 'png' });
      const file = `${name}--${vp.name}--${scheme}--ar.png`;
      writeFileSync(join(outDir, file), Buffer.from(shot.data, 'base64'));
      done.push(file);
    }
  }
}
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ done, skipped }, null, 2));
console.log(`${done.length} shots -> ${outDir}` + (skipped.length ? `\nskipped: ${skipped.join(', ')}` : ''));
ws.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
