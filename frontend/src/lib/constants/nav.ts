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

/** يظهر تحت الروابط الرئيسية في درج الهاتف. */
export const MOBILE_SECONDARY_NAV: NavItem[] = [
  { href: '/services', key: 'services' },
  { href: '/blog', key: 'blog' },
  { href: '/contact', key: 'contact' },
  // صاحب طلب سابق يعود من هاتفه ليتابعه — كان الرابط في التذييل وحده
  { href: '/track', key: 'track' },
];

export const LEGAL_NAV: NavItem[] = [
  { href: '/privacy-policy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
];
