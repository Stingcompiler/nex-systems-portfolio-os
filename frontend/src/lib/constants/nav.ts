/** مصدر واحد لروابط التنقل — تستخدمه الترويسة والقائمة الجوالة والتذييل. */

export interface NavItem {
  href: string;
  /** مفتاح الترجمة داخل namespace "nav" */
  key: string;
}

/**
 * أربعة روابط تجيب أسئلة الزائر الأساسية: ماذا تقدّمون، ماذا بنيتم،
 * كيف تعملون، ومن أنتم. زر «ابدأ مشروعك» بجوارها في الترويسة.
 *
 * الحلول القطاعية ودراسات الحالة تُصل من صفحتي الخدمات والأعمال،
 * والمدونة والتقنيات والتواصل في التذييل — كل المسارات باقية.
 */
export const MAIN_NAV: NavItem[] = [
  { href: '/services', key: 'services' },
  { href: '/projects', key: 'projects' },
  { href: '/process', key: 'process' },
  { href: '/about', key: 'about' },
];

/** يظهر تحت الروابط الرئيسية في درج الهاتف. */
export const MOBILE_SECONDARY_NAV: NavItem[] = [
  { href: '/solutions', key: 'solutions' },
  { href: '/blog', key: 'blog' },
  { href: '/contact', key: 'contact' },
];

export const LEGAL_NAV: NavItem[] = [
  { href: '/privacy-policy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
];
