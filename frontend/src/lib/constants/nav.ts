/** مصدر واحد لروابط التنقل — تستخدمه الترويسة والقائمة الجوالة والتذييل. */

export interface NavItem {
  href: string;
  /** مفتاح الترجمة داخل namespace "nav" */
  key: string;
}

/**
 * روابط الترويسة بعد قائمة «حلول لقطاعك» (مكوّن مستقل بالقطاعات وأيقوناتها):
 * ماذا بنيتم، كيف تعملون، ومن أنتم. الخدمات التقنية داخل تلك القائمة وفي
 * الدرج الثانوي والتذييل.
 */
export const MAIN_NAV: NavItem[] = [
  { href: '/projects', key: 'projects' },
  { href: '/process', key: 'process' },
  { href: '/about', key: 'about' },
];

/**
 * سطر صغير أسفل درج الهاتف: التواصل ومتابعة طلب قائم. «الخدمات» تكرّر رابط
 * «كل الحلول والخدمات التقنية» أعلى الدرج، و«المدونة» تعود حين تنتظم المقالات —
 * كلاهما في التذييل.
 */
export const MOBILE_SECONDARY_NAV: NavItem[] = [
  { href: '/contact', key: 'contact' },
  // صاحب طلب سابق يعود من هاتفه ليتابعه
  { href: '/track', key: 'track' },
];

export const LEGAL_NAV: NavItem[] = [
  { href: '/privacy-policy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
];
