/** تعريفات محرك الموارد: كل شاشة إدارية هي إعداد لا واجهة مكتوبة يدويًا. */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'bilingual-text'
  | 'bilingual-textarea'
  | 'number'
  | 'decimal'
  | 'switch'
  | 'select'
  | 'date'
  | 'url'
  | 'email'
  | 'media'
  | 'relation'
  | 'json-list'
  | 'readonly';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SubField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'bilingual-text' | 'bilingual-textarea';
}

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  /** لحقول العلاقة: نقطة النهاية وحقل العرض */
  endpoint?: string;
  labelKey?: string;
  multiple?: boolean;
  /** لحقول json-list: بنية العنصر الواحد */
  subFields?: SubField[];
  /** التبويب الذي يظهر فيه الحقل */
  tab?: string;
  /** عرض الحقل في الشبكة */
  full?: boolean;
  min?: number;
  max?: number;
}

export type BadgeTone = 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

export interface ColumnConfig {
  name: string;
  label: string;
  type?: 'text' | 'badge' | 'boolean' | 'date' | 'image' | 'number' | 'choice' | 'status';
  /** خريطة القيم إلى تسميات للأعمدة من نوع choice/status */
  map?: Record<string, string>;
  /** لأعمدة status: خريطة القيمة إلى نبرة لونية للشارة */
  tones?: Record<string, BadgeTone>;
}

export interface FilterConfig {
  name: string;
  label: string;
  options: SelectOption[];
}

export interface ResourceConfig {
  /** مفتاح التخزين المؤقت */
  key: string;
  /** المسار تحت /api/v1/ — مع شرطة في النهاية */
  endpoint: string;
  title: string;
  description?: string;
  /** الصلاحية اللازمة للكتابة */
  permission?: string;
  /** الحقل المستخدم في مسار التفاصيل */
  identifier?: 'id' | 'slug';
  columns: ColumnConfig[];
  filters?: FilterConfig[];
  fields: FieldConfig[];
  /** ترتيب التبويبات في النموذج */
  tabs?: { key: string; label: string }[];
  /** قيم تُرسل دائمًا مع الإنشاء (مثل kind للحلول) */
  createDefaults?: Record<string, unknown>;
  searchable?: boolean;
  /** بعض نقاط النهاية تعيد قائمة مباشرة بلا ترقيم صفحات */
  paginated?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
  /** إجراءات إضافية على السطر */
  publishAction?: boolean;
  emptyHint?: string;
}
