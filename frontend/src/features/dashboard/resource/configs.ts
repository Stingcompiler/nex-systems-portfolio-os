import type { ResourceConfig, SelectOption } from '@/features/dashboard/resource/types';

/** قوائم مطابقة لتعدادات الخلفية. */
const SECTORS: SelectOption[] = [
  { value: 'education', label: 'التعليم' },
  { value: 'retail', label: 'التجارة والبقالات' },
  { value: 'restaurants', label: 'المطاعم' },
  { value: 'accounting', label: 'المحاسبة' },
  { value: 'hr', label: 'الموارد البشرية' },
  { value: 'real_estate', label: 'العقارات' },
  { value: 'pharmacy', label: 'الصيدليات' },
  { value: 'healthcare', label: 'الرعاية الصحية' },
  { value: 'ngo', label: 'المنظمات' },
  { value: 'logistics', label: 'المخزون والتوزيع' },
  { value: 'general', label: 'عام' },
];

const PROJECT_TYPES: SelectOption[] = [
  { value: 'web', label: 'موقع أو تطبيق ويب' },
  { value: 'mobile', label: 'تطبيق موبايل' },
  { value: 'desktop', label: 'تطبيق سطح مكتب' },
  { value: 'api', label: 'واجهة برمجية' },
  { value: 'system', label: 'نظام إداري متكامل' },
  { value: 'other', label: 'أخرى' },
];

const PROJECT_STATUS: SelectOption[] = [
  { value: 'planning', label: 'قيد التخطيط' },
  { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'maintained', label: 'مكتمل وتحت الصيانة' },
  { value: 'archived', label: 'مؤرشف' },
];

const TECH_CATEGORIES: SelectOption[] = [
  { value: 'language', label: 'لغة برمجة' },
  { value: 'frontend', label: 'واجهة أمامية' },
  { value: 'backend', label: 'واجهة خلفية' },
  { value: 'mobile', label: 'موبايل' },
  { value: 'desktop', label: 'سطح مكتب' },
  { value: 'database', label: 'قواعد بيانات' },
  { value: 'tool', label: 'أدوات' },
];

const SECTOR_MAP = Object.fromEntries(SECTORS.map((entry) => [entry.value, entry.label]));

const SEO_TAB = { key: 'seo', label: 'SEO' };
const PUBLISH_TAB = { key: 'publish', label: 'النشر' };

/** حقول SEO المشتركة بين كل المحتوى القابل للنشر. */
const seoFields = [
  { name: 'seo_title', label: 'عنوان SEO', type: 'bilingual-text' as const, tab: 'seo',
    help: 'يظهر في نتيجة البحث. يُترك فارغًا ليُستخدم العنوان الأصلي.' },
  { name: 'seo_description', label: 'وصف SEO', type: 'bilingual-textarea' as const, tab: 'seo',
    help: '160 حرفًا تقريبًا.' },
  { name: 'og_image', label: 'صورة المشاركة', type: 'media' as const, tab: 'seo',
    help: 'تظهر عند مشاركة الرابط في واتساب ومواقع التواصل.' },
];

const publishFields = [
  { name: 'is_published', label: 'منشور', type: 'switch' as const, tab: 'publish' },
  { name: 'is_featured', label: 'مميز', type: 'switch' as const, tab: 'publish' },
  { name: 'display_order', label: 'الترتيب', type: 'number' as const, tab: 'publish' },
];

// --------------------------------------------------------------- الخدمات والحلول

function serviceConfig(kind: 'service' | 'solution'): ResourceConfig {
  const isService = kind === 'service';
  return {
    key: isService ? 'services' : 'solutions',
    endpoint: isService ? '/services/' : '/solutions/',
    identifier: 'slug',
    title: isService ? 'الخدمات' : 'الحلول القطاعية',
    description: isService
      ? 'خدمات التطوير التي تقدّمها. لا تُنشر صفحة دون 120 كلمة عربية على الأقل.'
      : 'أنظمة جاهزة للتخصيص حسب القطاع.',
    permission: 'portfolio.change_service',
    publishAction: true,
    createDefaults: { kind },
    columns: [
      { name: 'title_ar', label: 'العنوان' },
      { name: 'sector', label: 'القطاع', type: 'choice', map: SECTOR_MAP },
      { name: 'is_published', label: 'منشور', type: 'boolean' },
      { name: 'is_featured', label: 'مميز', type: 'boolean' },
      { name: 'display_order', label: 'الترتيب', type: 'number' },
    ],
    filters: [
      { name: 'sector', label: 'القطاع', options: SECTORS },
      {
        name: 'is_published',
        label: 'الحالة',
        options: [
          { value: 'true', label: 'منشور' },
          { value: 'false', label: 'مسودة' },
        ],
      },
    ],
    tabs: [
      { key: 'main', label: 'المحتوى' },
      { key: 'details', label: 'التفاصيل' },
      SEO_TAB,
      PUBLISH_TAB,
    ],
    fields: [
      { name: 'title', label: 'العنوان', type: 'bilingual-text', tab: 'main' },
      { name: 'sector', label: 'القطاع', type: 'select', options: SECTORS, tab: 'main' },
      { name: 'icon', label: 'الأيقونة', type: 'text', tab: 'main',
        help: 'اسم أيقونة من lucide، مثل: school' },
      { name: 'cover_image', label: 'صورة الغلاف', type: 'media', tab: 'main' },
      { name: 'short_description', label: 'الوصف المختصر', type: 'bilingual-textarea',
        tab: 'main', help: 'يظهر في البطاقات — جملتان على الأكثر.' },
      { name: 'description', label: 'الوصف الكامل', type: 'bilingual-textarea', tab: 'main',
        help: 'الحد الأدنى للنشر 120 كلمة عربية.' },

      { name: 'features', label: 'المميزات', type: 'json-list', tab: 'details',
        help: 'ثلاث مميزات على الأقل قبل النشر.',
        subFields: [
          { name: 'title', label: 'العنوان', type: 'bilingual-text' },
          { name: 'description', label: 'الوصف', type: 'bilingual-textarea' },
        ] },
      { name: 'deliverables', label: 'المخرجات', type: 'json-list', tab: 'details',
        subFields: [{ name: '', label: 'النص', type: 'bilingual-text' }] },
      { name: 'price_from', label: 'السعر يبدأ من', type: 'decimal', tab: 'details' },
      { name: 'price_currency', label: 'العملة', type: 'text', tab: 'details' },
      { name: 'price_note', label: 'ملاحظة السعر', type: 'bilingual-text', tab: 'details' },
      { name: 'duration_estimate', label: 'المدة التقديرية', type: 'bilingual-text', tab: 'details' },
      { name: 'technologies', label: 'التقنيات', type: 'relation', multiple: true,
        endpoint: '/technologies/', labelKey: 'name', tab: 'details' },
      { name: 'related_projects', label: 'مشاريع شاهدة', type: 'relation', multiple: true,
        endpoint: '/projects/', labelKey: 'title_ar', tab: 'details' },

      ...seoFields,
      ...publishFields,
    ],
    emptyHint: 'ابدأ بخدماتك الأساسية، وانشر ما يملك محتوى كافيًا فقط.',
  };
}

export const servicesConfig = serviceConfig('service');
export const solutionsConfig = serviceConfig('solution');

// --------------------------------------------------------------- المشاريع

export const projectsConfig: ResourceConfig = {
  key: 'projects',
  endpoint: '/projects/',
  identifier: 'slug',
  title: 'المشاريع',
  description: 'أعمالك المنفَّذة. لا تعرض اسم عميل بلا إذن صريح منه.',
  permission: 'portfolio.change_project',
  columns: [
    { name: 'title_ar', label: 'المشروع' },
    { name: 'sector', label: 'القطاع', type: 'choice', map: SECTOR_MAP },
    { name: 'client_name', label: 'العميل' },
    { name: 'is_published', label: 'منشور', type: 'boolean' },
    { name: 'is_featured', label: 'مميز', type: 'boolean' },
  ],
  filters: [
    { name: 'sector', label: 'القطاع', options: SECTORS },
    { name: 'project_type', label: 'النوع', options: PROJECT_TYPES },
  ],
  tabs: [
    { key: 'main', label: 'المحتوى' },
    { key: 'details', label: 'التفاصيل والروابط' },
    SEO_TAB,
    PUBLISH_TAB,
  ],
  fields: [
    { name: 'title', label: 'اسم المشروع', type: 'bilingual-text', tab: 'main' },
    { name: 'summary', label: 'وصف مختصر', type: 'bilingual-textarea', tab: 'main' },
    { name: 'description', label: 'الوصف الكامل', type: 'bilingual-textarea', tab: 'main' },
    { name: 'cover_image', label: 'صورة الغلاف', type: 'media', tab: 'main' },
    { name: 'images', label: 'معرض الصور', type: 'media-list', tab: 'main', full: true,
      help: 'تظهر أسفل صفحة المشروع بالترتيب هنا. التعليق اختياري.' },

    { name: 'sector', label: 'القطاع', type: 'select', options: SECTORS, tab: 'details' },
    { name: 'project_type', label: 'نوع المشروع', type: 'select', options: PROJECT_TYPES, tab: 'details' },
    { name: 'status', label: 'الحالة', type: 'select', options: PROJECT_STATUS, tab: 'details' },
    { name: 'client_name', label: 'اسم العميل', type: 'text', tab: 'details' },
    { name: 'client_permission', label: 'العميل يسمح بذكر اسمه', type: 'switch', tab: 'details',
      help: 'بدون إذن يُعرض المشروع مجهّلًا تلقائيًا.' },
    { name: 'completed_at', label: 'تاريخ الإنجاز', type: 'date', tab: 'details' },
    { name: 'technologies', label: 'التقنيات', type: 'relation', multiple: true,
      endpoint: '/technologies/', labelKey: 'name', tab: 'details' },
    { name: 'live_url', label: 'رابط الموقع', type: 'url', tab: 'details' },
    { name: 'github_url', label: 'رابط GitHub', type: 'url', tab: 'details' },
    { name: 'play_store_url', label: 'رابط Google Play', type: 'url', tab: 'details' },
    { name: 'app_store_url', label: 'رابط App Store', type: 'url', tab: 'details' },
    { name: 'video_url', label: 'رابط الفيديو', type: 'url', tab: 'details' },

    ...seoFields,
    ...publishFields,
  ],
};

// --------------------------------------------------------------- دراسات الحالة

export const caseStudiesConfig: ResourceConfig = {
  key: 'case-studies',
  endpoint: '/case-studies/',
  identifier: 'slug',
  title: 'دراسات الحالة',
  description: 'أقوى دليل على قدرتك — اربط كل دراسة بمشروع منفَّذ.',
  permission: 'portfolio.change_casestudy',
  columns: [
    { name: 'title_ar', label: 'العنوان' },
    { name: 'is_published', label: 'منشور', type: 'boolean' },
    { name: 'view_count', label: 'المشاهدات', type: 'number' },
  ],
  tabs: [
    { key: 'main', label: 'الأساسيات' },
    { key: 'story', label: 'السرد' },
    { key: 'extra', label: 'النتائج والمراحل' },
    SEO_TAB,
    PUBLISH_TAB,
  ],
  fields: [
    { name: 'project', label: 'المشروع', type: 'relation', endpoint: '/projects/',
      labelKey: 'title_ar', tab: 'main' },
    { name: 'title', label: 'العنوان', type: 'bilingual-text', tab: 'main' },
    { name: 'overview', label: 'نبذة', type: 'bilingual-textarea', tab: 'main' },
    { name: 'diagram_image', label: 'مخطط UML أو ERD', type: 'media', tab: 'main' },

    { name: 'problem', label: 'المشكلة', type: 'bilingual-textarea', tab: 'story' },
    { name: 'requirements', label: 'تحليل المتطلبات', type: 'bilingual-textarea', tab: 'story' },
    { name: 'challenges', label: 'التحديات', type: 'bilingual-textarea', tab: 'story' },
    { name: 'solution', label: 'الحل', type: 'bilingual-textarea', tab: 'story' },
    { name: 'architecture', label: 'المعمارية', type: 'bilingual-textarea', tab: 'story' },

    { name: 'results', label: 'النتائج', type: 'bilingual-textarea', tab: 'extra' },
    { name: 'lessons', label: 'الدروس المستفادة', type: 'bilingual-textarea', tab: 'extra' },
    { name: 'metrics', label: 'أرقام النتائج', type: 'json-list', tab: 'extra',
      help: 'أرقام حقيقية فقط.',
      subFields: [
        { name: 'label', label: 'التسمية', type: 'bilingual-text' },
        { name: 'value', label: 'القيمة', type: 'text' },
      ] },
    { name: 'development_phases', label: 'مراحل التطوير', type: 'json-list', tab: 'extra',
      subFields: [
        { name: 'title', label: 'العنوان', type: 'bilingual-text' },
        { name: 'description', label: 'الوصف', type: 'bilingual-textarea' },
      ] },
    { name: 'related_services', label: 'خدمات مرتبطة', type: 'relation', multiple: true,
      endpoint: '/services/', labelKey: 'title_ar', tab: 'extra' },

    ...seoFields,
    { name: 'is_published', label: 'منشور', type: 'switch', tab: 'publish' },
  ],
};

// --------------------------------------------------------------- التقنيات

export const technologiesConfig: ResourceConfig = {
  key: 'technologies',
  endpoint: '/technologies/',
  identifier: 'slug',
  title: 'التقنيات',
  permission: 'portfolio.change_technology',
  columns: [
    { name: 'name', label: 'الاسم' },
    { name: 'category', label: 'التصنيف', type: 'choice',
      map: Object.fromEntries(TECH_CATEGORIES.map((entry) => [entry.value, entry.label])) },
    { name: 'proficiency', label: 'الإتقان', type: 'number' },
    { name: 'is_featured', label: 'مميزة', type: 'boolean' },
    { name: 'is_active', label: 'مفعّلة', type: 'boolean' },
  ],
  filters: [{ name: 'category', label: 'التصنيف', options: TECH_CATEGORIES }],
  fields: [
    { name: 'name', label: 'الاسم', type: 'text' },
    { name: 'slug', label: 'المعرّف', type: 'text' },
    { name: 'category', label: 'التصنيف', type: 'select', options: TECH_CATEGORIES },
    { name: 'proficiency', label: 'مستوى الإتقان (1–5)', type: 'number', min: 1, max: 5 },
    { name: 'icon', label: 'الأيقونة', type: 'text' },
    { name: 'color', label: 'اللون', type: 'text', placeholder: '#2563EB' },
    { name: 'description', label: 'الوصف', type: 'bilingual-textarea' },
    { name: 'is_featured', label: 'مميزة (تظهر في الرئيسية)', type: 'switch' },
    { name: 'is_active', label: 'مفعّلة', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
};

// --------------------------------------------------------------- شهادات العملاء

export const testimonialsConfig: ResourceConfig = {
  key: 'testimonials',
  endpoint: '/testimonials/',
  title: 'شهادات العملاء',
  description: 'لا تُضف شهادة غير حقيقية. أضف رابطًا يثبتها كلما أمكن.',
  permission: 'portfolio.change_testimonial',
  columns: [
    { name: 'client_name_ar', label: 'العميل' },
    { name: 'company_ar', label: 'الجهة' },
    { name: 'rating', label: 'التقييم', type: 'number' },
    { name: 'is_published', label: 'منشورة', type: 'boolean' },
  ],
  fields: [
    { name: 'client_name', label: 'اسم العميل', type: 'bilingual-text' },
    { name: 'client_title', label: 'المسمى', type: 'bilingual-text' },
    { name: 'company', label: 'الجهة', type: 'bilingual-text' },
    { name: 'content', label: 'نص الشهادة', type: 'bilingual-textarea' },
    { name: 'rating', label: 'التقييم (1–5)', type: 'number', min: 1, max: 5 },
    { name: 'avatar', label: 'الصورة', type: 'media' },
    { name: 'project', label: 'المشروع', type: 'relation', endpoint: '/projects/', labelKey: 'title_ar' },
    { name: 'proof_url', label: 'رابط يثبت الشهادة', type: 'url',
      help: 'رابط LinkedIn أو رسالة عامة — يرفع المصداقية كثيرًا.' },
    { name: 'is_published', label: 'منشورة', type: 'switch' },
    { name: 'is_featured', label: 'مميزة', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
  emptyHint: 'قسم آراء العملاء مخفي من الموقع حتى تُضاف أول شهادة.',
};

// --------------------------------------------------------------- مراحل العمل

export const processStepsConfig: ResourceConfig = {
  key: 'process-steps',
  endpoint: '/process-steps/',
  title: 'مراحل العمل',
  description: 'تظهر في صفحة «طريقة العمل» وفي الرئيسية.',
  permission: 'core.change_processstep',
  paginated: false,
  searchable: false,
  columns: [
    { name: 'title_ar', label: 'المرحلة' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
    { name: 'is_active', label: 'مفعّلة', type: 'boolean' },
  ],
  fields: [
    { name: 'title', label: 'العنوان', type: 'bilingual-text' },
    { name: 'description', label: 'الوصف', type: 'bilingual-textarea' },
    { name: 'duration', label: 'المدة', type: 'bilingual-text' },
    { name: 'icon', label: 'الأيقونة', type: 'text' },
    { name: 'is_active', label: 'مفعّلة', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
};

// --------------------------------------------------------------- الأسئلة الشائعة

export const faqsConfig: ResourceConfig = {
  key: 'faqs',
  endpoint: '/faqs/',
  title: 'الأسئلة الشائعة',
  description: 'الإجابات التزامات تجارية — راجعها قبل التفعيل.',
  permission: 'core.change_faq',
  paginated: false,
  columns: [
    { name: 'question_ar', label: 'السؤال' },
    { name: 'scope', label: 'النطاق', type: 'choice',
      map: { global: 'عام', service: 'خدمة', pricing: 'الأسعار', process: 'طريقة العمل' } },
    { name: 'is_active', label: 'مفعّل', type: 'boolean' },
  ],
  fields: [
    { name: 'question', label: 'السؤال', type: 'bilingual-text' },
    { name: 'answer', label: 'الإجابة', type: 'bilingual-textarea' },
    { name: 'scope', label: 'النطاق', type: 'select',
      options: [
        { value: 'global', label: 'عام' },
        { value: 'service', label: 'خاص بخدمة' },
        { value: 'pricing', label: 'الأسعار' },
        { value: 'process', label: 'طريقة العمل' },
      ] },
    { name: 'service', label: 'الخدمة', type: 'relation', endpoint: '/services/', labelKey: 'title_ar' },
    { name: 'is_active', label: 'مفعّل', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
};

// --------------------------------------------------------------- الإحصائيات

export const statsConfig: ResourceConfig = {
  key: 'stats',
  endpoint: '/stats/',
  title: 'الإحصائيات',
  description: 'أرقام حقيقية فقط. القسم مخفي من الرئيسية حتى تُضاف أول إحصائية.',
  permission: 'core.change_stat',
  paginated: false,
  searchable: false,
  columns: [
    { name: 'value', label: 'القيمة' },
    { name: 'label_ar', label: 'التسمية' },
    { name: 'is_active', label: 'مفعّلة', type: 'boolean' },
  ],
  fields: [
    { name: 'value', label: 'القيمة', type: 'text', placeholder: '7' },
    { name: 'label', label: 'التسمية', type: 'bilingual-text' },
    { name: 'suffix', label: 'اللاحقة', type: 'bilingual-text', placeholder: '+' },
    { name: 'icon', label: 'الأيقونة', type: 'text' },
    { name: 'is_active', label: 'مفعّلة', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
};

// --------------------------------------------------------------- الموارد

export const resourcesConfig: ResourceConfig = {
  key: 'resources',
  endpoint: '/resources/',
  identifier: 'slug',
  title: 'الموارد',
  permission: 'portfolio.change_resource',
  columns: [
    { name: 'title_ar', label: 'العنوان' },
    { name: 'kind', label: 'النوع', type: 'choice',
      map: { pdf: 'ملف PDF', link: 'رابط', tool: 'أداة', template: 'قالب' } },
    { name: 'is_published', label: 'منشور', type: 'boolean' },
  ],
  fields: [
    { name: 'title', label: 'العنوان', type: 'bilingual-text' },
    { name: 'description', label: 'الوصف', type: 'bilingual-textarea' },
    { name: 'kind', label: 'النوع', type: 'select',
      options: [
        { value: 'pdf', label: 'ملف PDF' },
        { value: 'link', label: 'رابط' },
        { value: 'tool', label: 'أداة' },
        { value: 'template', label: 'قالب' },
      ] },
    { name: 'file', label: 'الملف', type: 'media' },
    { name: 'url', label: 'الرابط', type: 'url' },
    { name: 'cover_image', label: 'صورة الغلاف', type: 'media' },
    { name: 'requires_membership', label: 'يتطلب عضوية', type: 'switch' },
    { name: 'is_published', label: 'منشور', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
};

// --------------------------------------------------------------- صفحة «نبذة»

export const experiencesConfig: ResourceConfig = {
  key: 'experiences',
  endpoint: '/experiences/',
  title: 'الخبرات',
  permission: 'portfolio.change_experience',
  paginated: false,
  searchable: false,
  columns: [
    { name: 'title_ar', label: 'المسمى' },
    { name: 'organization_ar', label: 'الجهة' },
    { name: 'start_date', label: 'البداية', type: 'date' },
    { name: 'is_current', label: 'مستمر', type: 'boolean' },
  ],
  fields: [
    { name: 'title', label: 'المسمى', type: 'bilingual-text' },
    { name: 'organization', label: 'الجهة', type: 'bilingual-text' },
    { name: 'location', label: 'الموقع', type: 'bilingual-text' },
    { name: 'start_date', label: 'تاريخ البداية', type: 'date' },
    { name: 'end_date', label: 'تاريخ النهاية', type: 'date' },
    { name: 'is_current', label: 'مستمر حتى الآن', type: 'switch' },
    { name: 'description', label: 'الوصف', type: 'bilingual-textarea' },
    { name: 'is_active', label: 'ظاهر', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
};

export const educationConfig: ResourceConfig = {
  key: 'education',
  endpoint: '/education/',
  title: 'المؤهلات العلمية',
  permission: 'portfolio.change_education',
  paginated: false,
  searchable: false,
  columns: [
    { name: 'degree_ar', label: 'الدرجة' },
    { name: 'institution_ar', label: 'المؤسسة' },
    { name: 'end_date', label: 'التخرج', type: 'date' },
  ],
  fields: [
    { name: 'degree', label: 'الدرجة', type: 'bilingual-text' },
    { name: 'institution', label: 'المؤسسة', type: 'bilingual-text' },
    { name: 'field', label: 'التخصص', type: 'bilingual-text' },
    { name: 'start_date', label: 'تاريخ البداية', type: 'date' },
    { name: 'end_date', label: 'تاريخ التخرج', type: 'date' },
    { name: 'description', label: 'الوصف', type: 'bilingual-textarea' },
    { name: 'is_active', label: 'ظاهر', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
};

export const certificationsConfig: ResourceConfig = {
  key: 'certifications',
  endpoint: '/certifications/',
  title: 'الشهادات',
  permission: 'portfolio.change_certification',
  paginated: false,
  searchable: false,
  columns: [
    { name: 'name_ar', label: 'الشهادة' },
    { name: 'issuer_ar', label: 'الجهة المانحة' },
    { name: 'issue_date', label: 'تاريخ الإصدار', type: 'date' },
  ],
  fields: [
    { name: 'name', label: 'اسم الشهادة', type: 'bilingual-text' },
    { name: 'issuer', label: 'الجهة المانحة', type: 'bilingual-text' },
    { name: 'issue_date', label: 'تاريخ الإصدار', type: 'date' },
    { name: 'expiry_date', label: 'تاريخ الانتهاء', type: 'date' },
    { name: 'credential_id', label: 'رقم الشهادة', type: 'text' },
    { name: 'credential_url', label: 'رابط التحقق', type: 'url' },
    { name: 'image', label: 'الصورة', type: 'media' },
    { name: 'is_active', label: 'ظاهر', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
};

// --------------------------------------------------------------- روابط التواصل

export const socialLinksConfig: ResourceConfig = {
  key: 'social-links',
  endpoint: '/social-links/',
  title: 'روابط التواصل الاجتماعي',
  permission: 'core.change_sociallink',
  paginated: false,
  searchable: false,
  columns: [
    { name: 'platform_display', label: 'المنصة' },
    { name: 'url', label: 'الرابط' },
    { name: 'is_active', label: 'مفعّل', type: 'boolean' },
  ],
  fields: [
    { name: 'platform', label: 'المنصة', type: 'select',
      options: [
        { value: 'github', label: 'GitHub' },
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'x', label: 'X' },
        { value: 'facebook', label: 'Facebook' },
        { value: 'instagram', label: 'Instagram' },
        { value: 'youtube', label: 'YouTube' },
        { value: 'telegram', label: 'Telegram' },
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'email', label: 'البريد' },
        { value: 'other', label: 'أخرى' },
      ] },
    { name: 'label', label: 'التسمية', type: 'text' },
    { name: 'url', label: 'الرابط', type: 'url' },
    { name: 'is_active', label: 'مفعّل', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
};

// --------------------------------------------------------------- المدونة

const POST_STATUSES: SelectOption[] = [
  { value: 'draft', label: 'مسودة' },
  { value: 'in_review', label: 'قيد المراجعة' },
  { value: 'scheduled', label: 'مجدول' },
  { value: 'published', label: 'منشور' },
  { value: 'archived', label: 'مؤرشف' },
];

const POST_STATUS_MAP = Object.fromEntries(
  POST_STATUSES.map((entry) => [entry.value, entry.label]),
);

const POST_STATUS_TONES = {
  published: 'success',
  scheduled: 'accent',
  in_review: 'primary',
  draft: 'warning',
  archived: 'default',
} as const;

export const postsConfig: ResourceConfig = {
  key: 'posts',
  endpoint: '/posts/',
  identifier: 'slug',
  title: 'المقالات',
  description: 'لا يُنشر مقال دون 100 كلمة عربية على الأقل. المجدول يُنشر آليًا في موعده.',
  permission: 'blog.change_post',
  columns: [
    { name: 'title_ar', label: 'العنوان' },
    { name: 'status', label: 'الحالة', type: 'status', map: POST_STATUS_MAP, tones: POST_STATUS_TONES },
    { name: 'view_count', label: 'المشاهدات', type: 'number' },
    { name: 'is_featured', label: 'مميز', type: 'boolean' },
    { name: 'published_at', label: 'النشر', type: 'date' },
  ],
  filters: [{ name: 'is_featured', label: 'مميز',
    options: [{ value: 'true', label: 'نعم' }, { value: 'false', label: 'لا' }] }],
  tabs: [
    { key: 'main', label: 'المحتوى' },
    { key: 'meta', label: 'التصنيف والنشر' },
    SEO_TAB,
  ],
  fields: [
    { name: 'title', label: 'العنوان', type: 'bilingual-text', tab: 'main' },
    { name: 'excerpt', label: 'الملخص', type: 'bilingual-textarea', tab: 'main',
      help: 'يظهر في البطاقات ونتائج البحث — مطلوب للنشر.' },
    { name: 'content', label: 'المحتوى', type: 'bilingual-textarea', tab: 'main',
      help: 'الحد الأدنى للنشر 100 كلمة عربية. فقرات مفصولة بسطر فارغ.' },
    { name: 'cover_image', label: 'صورة الغلاف', type: 'media', tab: 'main' },

    { name: 'category', label: 'التصنيف', type: 'relation',
      endpoint: '/categories/', labelKey: 'name_ar', tab: 'meta' },
    { name: 'tags', label: 'الوسوم', type: 'relation', multiple: true,
      endpoint: '/tags/', labelKey: 'name_ar', tab: 'meta' },
    { name: 'status', label: 'الحالة', type: 'select', options: POST_STATUSES, tab: 'meta',
      help: 'المجدول يحتاج تاريخ نشر مستقبليًا.' },
    { name: 'published_at', label: 'تاريخ النشر', type: 'date', tab: 'meta',
      help: 'اتركه فارغًا لينضبط تلقائيًا عند النشر.' },
    { name: 'is_featured', label: 'مميز', type: 'switch', tab: 'meta' },
    { name: 'allow_comments', label: 'يسمح بالتعليقات', type: 'switch', tab: 'meta' },
    { name: 'related_posts', label: 'مقالات مرتبطة', type: 'relation', multiple: true,
      endpoint: '/posts/', labelKey: 'title_ar', tab: 'meta',
      help: 'اتركها فارغة لاقتراح مقالات التصنيف تلقائيًا.' },

    ...seoFields,
  ],
  emptyHint: 'اكتب أول مقال — قسم المدونة يظهر في الرئيسية عند نشر أول مقال.',
};

export const categoriesConfig: ResourceConfig = {
  key: 'categories',
  endpoint: '/categories/',
  identifier: 'slug',
  title: 'تصنيفات المدونة',
  permission: 'blog.change_category',
  paginated: false,
  searchable: false,
  columns: [
    { name: 'name_ar', label: 'الاسم' },
    { name: 'post_count', label: 'المقالات', type: 'number' },
    { name: 'is_active', label: 'مفعّل', type: 'boolean' },
  ],
  fields: [
    { name: 'name', label: 'الاسم', type: 'bilingual-text' },
    { name: 'description', label: 'الوصف', type: 'bilingual-textarea' },
    { name: 'color', label: 'اللون', type: 'text', placeholder: '#2563EB' },
    { name: 'is_active', label: 'مفعّل', type: 'switch' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ],
};

export const tagsConfig: ResourceConfig = {
  key: 'tags',
  endpoint: '/tags/',
  identifier: 'slug',
  title: 'الوسوم',
  permission: 'blog.change_tag',
  paginated: false,
  columns: [
    { name: 'name_ar', label: 'الاسم' },
    { name: 'usage_count', label: 'الاستخدام', type: 'number' },
  ],
  fields: [
    { name: 'name', label: 'الاسم', type: 'bilingual-text' },
  ],
};

// --------------------------------------------------------------- البريد المحظور

export const blockedEmailsConfig: ResourceConfig = {
  key: 'blocked-emails',
  endpoint: '/blocked-emails/',
  title: 'البريد المحظور',
  description: 'بريد أو نطاق محظور من التعليق. النطاق يبدأ بـ @ مثل @spam.com',
  permission: 'comments.change_comment',
  columns: [
    { name: 'value', label: 'البريد أو النطاق' },
    { name: 'reason', label: 'السبب' },
    { name: 'created_at', label: 'التاريخ', type: 'date' },
  ],
  fields: [
    { name: 'value', label: 'البريد أو النطاق', type: 'text',
      placeholder: 'spam@x.com أو @spam.com' },
    { name: 'reason', label: 'السبب', type: 'text' },
  ],
};

// --------------------------------------------------------------- المستخدمون

export const usersConfig: ResourceConfig = {
  key: 'users',
  endpoint: '/users/',
  title: 'المستخدمون',
  description: 'الأدوار تحدد الصلاحيات — تغيير الدور يزامن المجموعة تلقائيًا.',
  permission: 'core.manage_users',
  columns: [
    { name: 'full_name', label: 'الاسم' },
    { name: 'email', label: 'البريد' },
    { name: 'role_display', label: 'الدور' },
    { name: 'is_email_verified', label: 'بريد مؤكَّد', type: 'boolean' },
    { name: 'is_active', label: 'نشط', type: 'boolean' },
  ],
  filters: [
    {
      name: 'role',
      label: 'الدور',
      options: [
        { value: 'super_admin', label: 'مدير عام' },
        { value: 'content_manager', label: 'مدير محتوى' },
        { value: 'editor', label: 'محرر' },
        { value: 'crm_manager', label: 'مدير علاقات العملاء' },
        { value: 'marketing_manager', label: 'مدير تسويق' },
        { value: 'member', label: 'عضو' },
        { value: 'client', label: 'عميل' },
      ],
    },
  ],
  fields: [
    { name: 'full_name', label: 'الاسم الكامل', type: 'text' },
    { name: 'email', label: 'البريد الإلكتروني', type: 'email' },
    { name: 'phone', label: 'الهاتف', type: 'text' },
    { name: 'password', label: 'كلمة المرور', type: 'text',
      help: 'يُترك فارغًا عند التعديل للإبقاء على كلمة المرور الحالية.' },
    { name: 'role', label: 'الدور', type: 'select',
      options: [
        { value: 'super_admin', label: 'مدير عام' },
        { value: 'content_manager', label: 'مدير محتوى' },
        { value: 'editor', label: 'محرر' },
        { value: 'crm_manager', label: 'مدير علاقات العملاء' },
        { value: 'marketing_manager', label: 'مدير تسويق' },
        { value: 'member', label: 'عضو' },
        { value: 'client', label: 'عميل' },
      ] },
    { name: 'preferred_language', label: 'اللغة المفضلة', type: 'select',
      options: [
        { value: 'ar', label: 'العربية' },
        { value: 'en', label: 'English' },
      ] },
    { name: 'is_active', label: 'نشط', type: 'switch' },
  ],
};
