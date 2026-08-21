/** مصدر واحد لروابط التنقل — تستخدمه الترويسة والقائمة الجوالة والتذييل. */

export interface NavItem {
  href: string;
  /** مفتاح الترجمة داخل namespace "nav" */
  key: string;
}

export const MAIN_NAV: NavItem[] = [
  { href: '/services', key: 'services' },
  { href: '/solutions', key: 'solutions' },
  { href: '/projects', key: 'projects' },
  { href: '/case-studies', key: 'caseStudies' },
  { href: '/blog', key: 'blog' },
  { href: '/process', key: 'process' },
  { href: '/about', key: 'about' },
  { href: '/contact', key: 'contact' },
];

export const FOOTER_NAV: NavItem[] = [
  ...MAIN_NAV,
  { href: '/technologies', key: 'technologies' },
];

export const LEGAL_NAV: NavItem[] = [
  { href: '/privacy-policy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
];
