'use client';

import { ArrowLeft, ArrowRight, Check, LoaderCircle, MessageCircle, Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useRef, useState, type ReactNode } from 'react';

import { buttonClass } from '@/components/ui/button';
import { fieldClass } from '@/components/ui/field';
import { api, toApiError } from '@/lib/api/client';
import type { Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils/cn';
import { whatsappLink } from '@/lib/utils/format';

interface Option {
  value: string;
  label: string;
}

/** الخدمة التي بدأ منها الزائر («اطلب هذه الخدمة»). */
export interface RequestServiceContext {
  slug: string;
  title: string;
}

type Step = 1 | 2 | 3;
type FieldErrors = Partial<Record<'description' | 'contact' | 'email' | 'phone', string>>;

/** يطابق MIN_REQUEST_DESCRIPTION في الخادم. */
const MIN_DESCRIPTION = 10;
const STEPS = 3;
const UNSURE = 'unsure';

/** معرّف لكل محاولة إرسال — يمنع تكرار الطلب عند إعادة المحاولة بعد استجابة مفقودة. */
function newSubmissionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * نموذج طلب المشروع بثلاث خطوات: الفكرة، ثم تفاصيل اختيارية، ثم التواصل
 * والمراجعة.
 *
 * الطلب يجب أن يكون قابلًا للرد: وصف مختصر ووسيلة تواصل واحدة على الأقل.
 * التحقق نفسه في الخادم؛ هنا يُعرض الخطأ قرب حقله قبل الإرسال. البيانات
 * تبقى في الذاكرة عند الرجوع بين الخطوات وعند فشل الشبكة.
 */
export function RequestForm({
  whatsapp,
  whatsappMessage,
  service,
}: {
  whatsapp: string;
  whatsappMessage: string;
  service?: RequestServiceContext | null;
}) {
  const t = useTranslations('requestForm');
  const locale = useLocale() as Locale;

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [submissionId] = useState(newSubmissionId);
  // حارس متزامن: الحالة لا تتحدّث قبل النقرة الثانية السريعة
  const inFlight = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [form, setForm] = useState({
    project_type: '',
    sector: '',
    description: '',
    budget_range: '',
    timeline: '',
    requirements: {
      marketing_site: false,
      dashboard: false,
      members: false,
      blog: false,
      store: false,
      pwa: false,
    } as Record<string, boolean>,
    name: '',
    email: '',
    phone: '',
    company: '',
    website: '', // honeypot
  });

  const projectTypes: Option[] = [
    'website', 'mobile', 'desktop', 'system', 'existing', 'api', 'hosting', 'consulting', UNSURE,
  ].map((value) => ({ value, label: t(`projectType.${value}`) }));

  const sectors: Option[] = [
    'education', 'retail', 'restaurants', 'accounting', 'hr',
    'real_estate', 'pharmacy', 'ngo', 'general',
  ].map((value) => ({ value, label: t(`sector.${value}`) }));

  const budgets: Option[] = [
    'under_500', '500_2000', '2000_5000', '5000_10000', 'over_10000', 'unsure',
  ].map((value) => ({ value, label: t(`budget.${value}`) }));

  const timelines: Option[] = ['urgent', 'short', 'medium', 'flexible'].map((value) => ({
    value,
    label: t(`timeline.${value}`),
  }));

  const modules = ['marketing_site', 'dashboard', 'members', 'blog', 'store', 'pwa'].map(
    (key) => ({ key, title: t(`module.${key}.title`), desc: t(`module.${key}.desc`) }),
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    // الخطأ يختفي حين يبدأ الزائر تصحيحه
    if (key === 'description' && errors.description) {
      setErrors(({ description: _omit, ...rest }) => rest);
    }
    if ((key === 'email' || key === 'phone') && (errors.contact || errors[key])) {
      setErrors(({ contact: _c, [key]: _f, ...rest }) => rest);
    }
  }

  function goTo(next: Step) {
    setStep(next);
    setFormError(null);
    // نقل التركيز إلى عنوان الخطوة يُعلم قارئ الشاشة بالانتقال
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function validateIdea(): FieldErrors {
    return form.description.trim().length < MIN_DESCRIPTION
      ? { description: t('errors.description') }
      : {};
  }

  function validateContact(): FieldErrors {
    const found: FieldErrors = {};
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!email && !phone) found.contact = t('errors.contact');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = t('errors.email');
    if (phone && phone.replace(/\D/g, '').length < 7) found.phone = t('errors.phone');
    return found;
  }

  function next() {
    if (step === 1) {
      const found = validateIdea();
      setErrors(found);
      if (Object.keys(found).length) return;
    }
    goTo((step + 1) as Step);
  }

  async function submit() {
    if (inFlight.current) return;

    const ideaErrors = validateIdea();
    const contactErrors = validateContact();
    if (Object.keys(ideaErrors).length) {
      setErrors(ideaErrors);
      goTo(1);
      return;
    }
    if (Object.keys(contactErrors).length) {
      setErrors(contactErrors);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const { project_type, ...rest } = form;
      const { data } = await api.post<{ reference_code: string }>(
        '/project-requests/submit/',
        {
          ...rest,
          description: form.description.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          project_type: project_type === UNSURE ? '' : project_type,
          service: service?.slug ?? null,
          submission_id: submissionId,
          preferred_language: locale,
        },
      );
      setReference(data.reference_code);
    } catch (caught) {
      const payload = toApiError(caught);
      const server = payload.errors ?? {};
      const mapped: FieldErrors = {};
      if (server.description) mapped.description = t('errors.description');
      if (server.contact) mapped.contact = t('errors.contact');
      if (server.email) mapped.email = t('errors.email');
      if (server.phone) mapped.phone = t('errors.phone');
      setErrors(mapped);

      if (mapped.description) goTo(1);
      else if (!Object.keys(mapped).length) {
        // فشل شبكة أو خادم: البيانات باقية، والمعرّف نفسه يُرسل عند المحاولة
        setFormError(
          payload.code === 'network_error' || !payload.code || payload.code === 'error'
            ? t('errors.network')
            : payload.detail,
        );
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const waLink = whatsapp ? whatsappLink(whatsapp, whatsappMessage) : '';

  if (reference) {
    return (
      <div
        role="status"
        className="mx-auto max-w-2xl rounded-xl border border-border bg-surface p-8 text-center sm:p-10"
      >
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-success-soft">
          <Check className="size-7 text-success" aria-hidden="true" />
        </span>
        <h2 className="text-h2 font-semibold">{t('successTitle')}</h2>
        <p className="mx-auto mt-3 max-w-prose text-muted">{t('successBody')}</p>
        <p className="mt-5 inline-block rounded-lg bg-surface-hover px-4 py-2 text-sm">
          {t('reference')}: <strong dir="ltr" className="font-mono">{reference}</strong>
        </p>
        <div className="mx-auto mt-6 max-w-prose rounded-lg border border-border p-4 text-start text-sm">
          <p className="font-medium">{t('nextStepTitle')}</p>
          <p className="mt-1 text-muted">
            {t(form.email.trim() ? 'nextStepEmail' : 'nextStepPhone')}
          </p>
          {/* النص نفسه في الملخّص الجانبي — التزام واحد في كل الرحلة */}
          <p className="mt-2 flex items-center gap-2 text-muted">
            <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
            {t('replyPromise')}
          </p>
        </div>
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {t('whatsappFollowUp')}
          </a>
        ) : null}
      </div>
    );
  }

  const stepNames = ['idea', 'details', 'contact'] as const;
  const selectedModules = modules.filter((module) => form.requirements[module.key]);
  const optionLabel = (options: Option[], value: string) =>
    options.find((option) => option.value === value)?.label;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-8">
        {/* مؤشر الخطوات: نص صريح لقارئ الشاشة والهاتف، وتسميات على الشاشات الأوسع */}
        <p className="mb-3 text-sm font-medium text-muted" aria-live="polite">
          {t('stepOf', { step, total: STEPS })}
        </p>
        <ol className="mb-8 flex items-center gap-2" aria-label={t('steps')}>
          {stepNames.map((name, position) => {
            const index = position + 1;
            return (
              <li key={name} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                    step >= index
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-hover text-muted',
                  )}
                  aria-current={step === index ? 'step' : undefined}
                >
                  {step > index ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <span className="code-inline">{index}</span>
                  )}
                </span>
                <span
                  className={cn(
                    'hidden text-sm font-medium sm:block',
                    step >= index ? 'text-foreground' : 'text-muted',
                  )}
                >
                  {t(`stepName.${name}`)}
                </span>
                {index < STEPS ? (
                  <span
                    className={cn('h-0.5 flex-1 rounded', step > index ? 'bg-primary' : 'bg-border')}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* honeypot */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => set('website', event.target.value)}
          className="sr-only"
          aria-hidden="true"
        />

        {step === 1 ? (
          <StepBody title={t('step1Title')} headingRef={headingRef}>
            {service ? (
              <p className="rounded-lg border border-primary/30 bg-primary-soft px-4 py-3 text-sm">
                {t('serviceContext')} <strong>{service.title}</strong>
              </p>
            ) : null}
            <TextArea
              label={t('descriptionLabel')}
              hint={t('descriptionHint')}
              value={form.description}
              onChange={(value) => set('description', value)}
              placeholder={t('descriptionPlaceholder')}
              required
              error={errors.description}
            />
            <ChoiceGrid
              label={t('projectTypeLabel')}
              options={projectTypes}
              value={form.project_type}
              onChange={(value) => set('project_type', value)}
            />
          </StepBody>
        ) : null}

        {step === 2 ? (
          <StepBody title={t('step2Title')} subtitle={t('step2Help')} headingRef={headingRef}>
            <SelectField
              label={t('sectorLabel')}
              options={sectors}
              value={form.sector}
              onChange={(value) => set('sector', value)}
              placeholder={t('sectorPlaceholder')}
            />
            <fieldset>
              <legend className="mb-1 text-sm font-medium">{t('scopeLabel')}</legend>
              <p className="mb-3 text-sm text-muted">{t('scopeHelp')}</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => {
                  const checked = form.requirements[module.key];
                  return (
                    <label
                      key={module.key}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
                        checked
                          ? 'border-primary bg-primary-soft'
                          : 'border-border hover:bg-surface-hover',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          set('requirements', {
                            ...form.requirements,
                            [module.key]: event.target.checked,
                          })
                        }
                        className="mt-0.5 size-4 accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{module.title}</span>
                        <span className="block text-sm text-muted">{module.desc}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div>
              <ChoiceGrid
                label={t('budgetSectionLabel')}
                options={budgets}
                value={form.budget_range}
                onChange={(value) => set('budget_range', value)}
              />
              <p className="mt-2 text-sm text-muted">{t('budgetHelp')}</p>
            </div>
            <ChoiceGrid
              label={t('timelineLabel')}
              options={timelines}
              value={form.timeline}
              onChange={(value) => set('timeline', value)}
            />
          </StepBody>
        ) : null}

        {step === 3 ? (
          <StepBody title={t('step3Title')} subtitle={t('step3Help')} headingRef={headingRef}>
            {errors.contact ? (
              <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
                {errors.contact}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t('emailLabel')}
                type="email"
                dir="ltr"
                autoComplete="email"
                value={form.email}
                onChange={(value) => set('email', value)}
                error={errors.email}
                invalid={Boolean(errors.contact)}
              />
              <TextField
                label={t('phoneLabel')}
                type="tel"
                dir="ltr"
                autoComplete="tel"
                value={form.phone}
                onChange={(value) => set('phone', value)}
                error={errors.phone}
                invalid={Boolean(errors.contact)}
              />
              <TextField
                label={t('nameLabel')}
                optional={t('optional')}
                autoComplete="name"
                value={form.name}
                onChange={(value) => set('name', value)}
              />
              <TextField
                label={t('companyLabel')}
                optional={t('optional')}
                autoComplete="organization"
                value={form.company}
                onChange={(value) => set('company', value)}
              />
            </div>

            {/* المراجعة: كل سطر يعود إلى خطوته للتعديل دون فقد شيء */}
            <section aria-labelledby="request-review" className="rounded-xl border border-border p-4 sm:p-5">
              <h3 id="request-review" className="mb-3 text-base font-semibold">
                {t('reviewTitle')}
              </h3>
              <dl className="divide-y divide-border text-sm">
                <ReviewRow
                  label={t('descriptionLabel')}
                  value={form.description.trim()}
                  editLabel={t('edit')}
                  onEdit={() => goTo(1)}
                  multiline
                />
                <ReviewRow
                  label={t('summaryType')}
                  value={optionLabel(projectTypes, form.project_type) || t('notSpecified')}
                  editLabel={t('edit')}
                  onEdit={() => goTo(1)}
                />
                <ReviewRow
                  label={t('step2Title')}
                  value={
                    [
                      optionLabel(sectors, form.sector),
                      selectedModules.map((module) => module.title).join('، '),
                      optionLabel(budgets, form.budget_range),
                      optionLabel(timelines, form.timeline),
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('notSpecified')
                  }
                  editLabel={t('edit')}
                  onEdit={() => goTo(2)}
                />
              </dl>
            </section>
          </StepBody>
        ) : null}

        {formError ? (
          <div role="alert" className="mt-6 rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm">
            {formError}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => goTo((step - 1) as Step)}
              className={buttonClass('secondary')}
            >
              <ArrowLeft className="size-4 flip-rtl" aria-hidden="true" />
              {t('back')}
            </button>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {step === 2 ? (
              <button
                type="button"
                onClick={() => goTo(3)}
                className={buttonClass('ghost', 'md', 'text-muted hover:text-foreground')}
              >
                {t('skip')}
              </button>
            ) : null}
            {step < STEPS ? (
              <button
                type="button"
                onClick={next}
                className={buttonClass('primary')}
              >
                {t('next')}
                <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                aria-busy={submitting || undefined}
                onClick={submit}
                className={buttonClass('primary')}
              >
                {submitting ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {submitting ? t('submitting') : formError ? t('retry') : t('submit')}
              </button>
            )}
          </div>
        </div>

        {waLink ? (
          <div className="mt-6 border-t border-border pt-4 text-center">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {t('preferWhatsapp')}
            </a>
          </div>
        ) : null}
      </div>

      {/* ملخّص جانبي على الشاشات الواسعة؛ على الهاتف تحلّ محله المراجعة في الخطوة الأخيرة */}
      <aside className="hidden rounded-xl border border-border bg-surface p-6 shadow-subtle lg:sticky lg:top-24 lg:block">
        <h2 className="mb-4 text-h3 font-semibold">{t('summaryTitle')}</h2>

        {form.description.trim() || form.project_type || service ? (
          <dl className="space-y-3 text-sm">
            {service ? (
              <SummaryRow label={t('summaryService')} value={service.title} />
            ) : null}
            {form.project_type ? (
              <SummaryRow
                label={t('summaryType')}
                value={optionLabel(projectTypes, form.project_type) ?? ''}
              />
            ) : null}
            {selectedModules.length ? (
              <SummaryRow
                label={t('summaryFeatures')}
                value={t('summaryCount', { count: selectedModules.length, total: modules.length })}
              />
            ) : null}
            {form.budget_range ? (
              <SummaryRow label={t('budgetLabel')} value={optionLabel(budgets, form.budget_range) ?? ''} />
            ) : null}
            {form.timeline ? (
              <SummaryRow label={t('timelineLabel')} value={optionLabel(timelines, form.timeline) ?? ''} />
            ) : null}
            {form.description.trim() ? (
              <div>
                <dt className="text-muted">{t('descriptionLabel')}</dt>
                <dd className="mt-1 line-clamp-4 whitespace-pre-line">{form.description.trim()}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-muted">{t('summaryPlaceholder')}</p>
        )}

        <p className="mt-5 flex items-center gap-2 rounded-lg bg-surface-hover p-3 text-sm">
          <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
          {t('replyPromise')}
        </p>
      </aside>
    </div>
  );
}

// --------------------------------------------------------------- عناصر مساعدة

function StepBody({
  title,
  subtitle,
  headingRef,
  children,
}: {
  title: string;
  subtitle?: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-h3 font-semibold focus:outline-none">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium">{value}</dd>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  editLabel,
  onEdit,
  multiline = false,
}: {
  label: string;
  value: string;
  editLabel: string;
  onEdit: () => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <dt className="text-muted">{label}</dt>
        <dd className={cn('mt-0.5 break-words', multiline && 'line-clamp-3 whitespace-pre-line')}>
          {value}
        </dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm text-primary hover:bg-surface-hover"
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        {editLabel}
        <span className="sr-only">: {label}</span>
      </button>
    </div>
  );
}

function ChoiceGrid({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            // النقر على الخيار المحدد يلغيه — كل الخيارات هنا اختيارية
            onClick={() => onChange(value === option.value ? '' : option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'min-h-11 rounded-lg border px-3 py-2 text-sm transition-colors',
              value === option.value
                ? 'border-primary bg-primary-soft font-medium text-primary'
                : 'border-border hover:bg-surface-hover',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass()}
      >
        <option value="">{placeholder || '—'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  dir,
  autoComplete,
  optional,
  error,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  dir?: 'ltr' | 'rtl';
  autoComplete?: string;
  /** نص «اختياري» يُلحق بالتسمية */
  optional?: string;
  error?: string;
  /** تمييز الحقل دون رسالة خاصة به (الخطأ مشترك بين حقلين) */
  invalid?: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasError = Boolean(error) || Boolean(invalid);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {optional ? <span className="font-normal text-muted"> ({optional})</span> : null}
      </label>
      <input
        id={id}
        type={type}
        dir={dir}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={hasError || undefined}
        aria-describedby={error ? errorId : undefined}
        className={fieldClass({ invalid: hasError, className: dir === 'ltr' ? 'text-start' : undefined })}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TextArea({
  label,
  hint,
  value,
  onChange,
  placeholder,
  required,
  error,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="mb-2 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        aria-required={required || undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined}
        className={fieldClass({ invalid: Boolean(error), multiline: true, className: 'min-h-32' })}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
