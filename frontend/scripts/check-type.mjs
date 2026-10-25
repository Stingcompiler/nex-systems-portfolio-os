// فحص نظام الخطوط — أمر العمل B1–B3 والقرار D-0011 (npm run check:type).
// ينتهي بالفشل عند:
//  1. عائلة خط خارج القرار (next/font غير IBM Plex Sans/Arabic، أو @font-face أو Google Fonts).
//  2. قيمة خط داخل مكوّن: style={{ fontSize | fontFamily }} أو font-mono/code-inline/tabular-nums
//     بدل .num (المكان الوحيد للأرقام الجدولية).
//  3. حجم خط دون 12px (text-[…] أو text-[0.7rem]…).
//  4. رقم ظاهر بلا .num: تعبير JSX لحقل رقمي معروف الاسم وسطره وما قبله بلا num.
// استثناء سطر بعينه: تعليق `type-ok: <السبب>` في السطر نفسه أو الذي قبله.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED_FONTS = new Set(['IBM_Plex_Sans', 'IBM_Plex_Sans_Arabic']);
// D-0012: خط العرض للموقع التعريفي وحده — لا داخل اللوحة
const DISPLAY_FONTS = new Set(['Alexandria', 'Montserrat']);
const DISPLAY_FONTS_FILE = 'src/app/[locale]/layout.tsx';
// الملف الوحيد المسموح له بأسلوب مضمّن: يُرسم خارج التخطيطات بلا CSS الموقع
const INLINE_STYLE_OK = new Set(['src/app/global-error.tsx']);
// تعبير يبدأ بمسار متغير وينتهي بحقل رقمي، أو رقم خطوة (index + 1)
const NUMERIC = /\{\s*(?:[\w?.()]*\(\s*)?[\w?.]*\b(?:\w+_count|count|total|total_recipients|unread|price|amount|rating|proficiency|completion|reference_code|size)\b\s*\)?\s*(?:[+\/]\s*[\w.]+\s*)?\}|index \+ 1\s*\}/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

const problems = [];
for (const file of walk('src')) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const at = `${file}:${index + 1}`;
    const waived = /type-ok:/.test(line) || /type-ok:/.test(lines[index - 1] ?? '');
    if (waived || /^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const report = (why) => problems.push(`${why}\n    ${at}: ${line.trim().slice(0, 140)}`);

    const font = line.match(/import \{([^}]+)\} from 'next\/font\/google'/);
    if (font) {
      for (const name of font[1].split(',').map((x) => x.trim()).filter(Boolean)) {
        const display = DISPLAY_FONTS.has(name) && file === DISPLAY_FONTS_FILE;
        if (!ALLOWED_FONTS.has(name) && !display) report(`عائلة خارج القرارين D-0011/D-0012: ${name}`);
      }
    }
    if (/@font-face|fonts\.googleapis/.test(line)) report('تحميل خط خارج next/font');
    if (!INLINE_STYLE_OK.has(file) && /\b(fontSize|fontFamily)\s*:/.test(line)) report('قيمة خط داخل مكوّن');
    if (file.endsWith('.tsx') && /\b(font-mono|code-inline|tabular-nums)\b/.test(line)) report('رقم بغير .num');
    if (/<t[dh][^>]*className="[^"]*\bnum\b[^"]*\btext-start\b/.test(line)) report('عمود رقمي بمحاذاة البداية');
    for (const match of line.matchAll(/text-\[(\d*\.?\d+)(px|rem)\]/g)) {
      const px = match[2] === 'rem' ? Number(match[1]) * 16 : Number(match[1]);
      if (px < 12) report(`حجم خط ${px}px دون الحد 12px`);
    }
    if (file.endsWith('.tsx') && NUMERIC.test(line) && !/\bnum\b/.test(line) && !/\bnum\b/.test(lines[index - 1] ?? '')) {
      // داخل نص JSX فقط: لا خصائص ولا شروط ولا تعليقات
      const jsxText = />[^<]*\{[^}]*\}/.test(line) || /^\s*\{[^}]*\}\s*$/.test(line);
      if (jsxText && !/aria-|title=|label=|`/.test(line)) report('رقم ظاهر بلا .num');
    }
  });
}

for (const problem of problems) console.log(`✗ ${problem}`);
process.exit(problems.length ? 1 : 0);
