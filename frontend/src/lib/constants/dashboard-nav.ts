/** قائمة لوحة التحكم — مصدر واحد للشريط الجانبي وفتات الخبز. */

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: string;
  /** الصلاحية اللازمة لرؤية العنصر — فارغ يعني متاح لكل مستخدمي اللوحة */
  permission?: string;
}

export interface DashboardNavGroup {
  label: string;
  items: DashboardNavItem[];
}

export const DASHBOARD_NAV: DashboardNavGroup[] = [
  {
    label: '',
    items: [{ href: '/dashboard', label: 'نظرة عامة', icon: 'LayoutDashboard' }],
  },
  {
    label: 'المحتوى',
    items: [
      { href: '/dashboard/content/home', label: 'الصفحة الرئيسية', icon: 'Home',
        permission: 'core.change_pagesection' },
      { href: '/dashboard/content/services', label: 'الخدمات', icon: 'Wrench',
        permission: 'portfolio.change_service' },
      { href: '/dashboard/content/solutions', label: 'الحلول', icon: 'Boxes',
        permission: 'portfolio.change_service' },
      { href: '/dashboard/content/projects', label: 'المشاريع', icon: 'FolderKanban',
        permission: 'portfolio.change_project' },
      { href: '/dashboard/content/case-studies', label: 'دراسات الحالة', icon: 'FileText',
        permission: 'portfolio.change_casestudy' },
      { href: '/dashboard/content/technologies', label: 'التقنيات', icon: 'Cpu',
        permission: 'portfolio.change_technology' },
      { href: '/dashboard/content/testimonials', label: 'شهادات العملاء', icon: 'Quote',
        permission: 'portfolio.change_testimonial' },
      { href: '/dashboard/content/process', label: 'طريقة العمل', icon: 'ListChecks',
        permission: 'core.change_processstep' },
      { href: '/dashboard/content/faq', label: 'الأسئلة الشائعة', icon: 'CircleHelp',
        permission: 'core.change_faq' },
      { href: '/dashboard/content/stats', label: 'الإحصائيات', icon: 'ChartNoAxesColumn',
        permission: 'core.change_stat' },
      { href: '/dashboard/content/resources', label: 'الموارد', icon: 'Download',
        permission: 'portfolio.change_resource' },
      { href: '/dashboard/content/about', label: 'الخبرات والمؤهلات', icon: 'GraduationCap',
        permission: 'portfolio.change_experience' },
    ],
  },
  {
    label: 'المدونة',
    items: [
      { href: '/dashboard/blog/posts', label: 'المقالات', icon: 'PenLine',
        permission: 'blog.change_post' },
      { href: '/dashboard/blog/taxonomy', label: 'التصنيفات والوسوم', icon: 'Tags',
        permission: 'blog.change_category' },
    ],
  },
  {
    label: 'العملاء',
    items: [
      { href: '/dashboard/crm/leads', label: 'العملاء المحتملون', icon: 'UserPlus',
        permission: 'crm.view_lead' },
      { href: '/dashboard/crm/clients', label: 'العملاء', icon: 'Users',
        permission: 'crm.view_client' },
      { href: '/dashboard/crm/requests', label: 'طلبات المشاريع', icon: 'Inbox',
        permission: 'crm.view_projectrequest' },
      { href: '/dashboard/crm/messages', label: 'رسائل التواصل', icon: 'Mail',
        permission: 'crm.view_contactmessage' },
      { href: '/dashboard/crm/follow-ups', label: 'المتابعات', icon: 'CalendarClock',
        permission: 'crm.view_followup' },
    ],
  },
  {
    label: 'المجتمع',
    items: [
      { href: '/dashboard/community/comments', label: 'التعليقات', icon: 'MessageSquare',
        permission: 'comments.approve_comment' },
      { href: '/dashboard/community/reports', label: 'البلاغات', icon: 'Flag',
        permission: 'comments.change_commentreport' },
      { href: '/dashboard/community/blocked-emails', label: 'البريد المحظور', icon: 'Ban',
        permission: 'comments.change_comment' },
    ],
  },
  {
    label: 'الوسائط',
    items: [
      { href: '/dashboard/media', label: 'مكتبة الوسائط', icon: 'Image',
        permission: 'core.manage_media' },
    ],
  },
  {
    label: 'النظام',
    items: [
      { href: '/dashboard/analytics', label: 'التحليلات', icon: 'ChartNoAxesColumn',
        permission: 'core.view_analytics' },
      { href: '/dashboard/notifications', label: 'الإشعارات', icon: 'Bell' },
      { href: '/dashboard/settings', label: 'إعدادات الموقع', icon: 'Settings',
        permission: 'core.manage_settings' },
      { href: '/dashboard/users', label: 'المستخدمون', icon: 'Users',
        permission: 'core.manage_users' },
      { href: '/dashboard/audit-logs', label: 'سجل التدقيق', icon: 'History',
        permission: 'core.view_auditlog_full' },
    ],
  },
];
