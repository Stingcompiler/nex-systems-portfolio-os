/**
 * يُنفَّذ قبل أول رسم للصفحة فيمنع وميض الوضع الفاتح على مستخدمي الوضع الداكن.
 *
 * هذا هو الاستثناء الوحيد لقاعدة عدم استخدام localStorage: لا يخزّن شيئًا
 * حساسًا، ولا يمكن أن تأتي القيمة من الخادم لأن الصفحات مولَّدة ثابتًا.
 */
const SCRIPT = `(function(){try{
var s=localStorage.getItem('theme');
var d=s==='dark'||((!s||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark',d);
}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
