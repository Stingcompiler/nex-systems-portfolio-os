// فحص مستوى القراءة لنصوص الصفحة الرئيسية — LANDING.md §2:
// متوسط طول الجملة ≤ 14 كلمة، ولا جملة واحدة تتجاوز 20 كلمة.
// يقرأ نصوص الترجمة (home) ونص البطل المنشور من الموقع إن أُعطي رابطه.
//   node scripts/check-copy.mjs [https://stingdev.pro/ar]
import { readFileSync } from 'node:fs';

const MAX_AVG = 14;
const MAX_ONE = 20;

function strings(value) {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const home = JSON.parse(readFileSync('src/messages/ar.json', 'utf8')).home;
let texts = strings(home).filter((text) => !text.includes('{'));

const url = process.argv[2];
if (url) {
  const html = await (await fetch(url)).text();
  const pick = (re) => (html.match(re)?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  texts.push(pick(/<h1[^>]*>([\s\S]*?)<\/h1>/), pick(/<h1[\s\S]*?<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/));
}

const sentences = texts
  .flatMap((text) => text.split(/[.!؟?\n]+/))
  .map((sentence) => sentence.trim().split(/\s+/).filter(Boolean))
  .filter((words) => words.length >= 3);
const average = sentences.reduce((sum, words) => sum + words.length, 0) / sentences.length;
const long = sentences.filter((words) => words.length > MAX_ONE);

console.log(`${sentences.length} جملة، متوسط ${average.toFixed(1)} كلمة (الحد ${MAX_AVG})`);
for (const words of long) console.log(`✗ ${words.length} كلمة: ${words.join(' ')}`);
process.exit(average > MAX_AVG || long.length ? 1 : 0);
