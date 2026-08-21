'use client';

import { ArrowLeft, ArrowRight, Check, LoaderCircle, MessageCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { api, fieldError, toApiError, type ApiErrorPayload } from '@/lib/api/client';
import type { Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils/cn';
import { whatsappLink } from '@/lib/utils/format';

interface Option {
  value: string;
  label: string;
}

/**
 * نموذج طلب المشروع بثلاث خطوات.
 *
 * قُلّص من خمس خطوات إلى ثلاث عمدًا: كل خطوة إضافية تفقد نسبة من المتقدمين،
 * وهذا أهم مسار تحويل في الموقع. مخرج واتساب حاضر في كل خطوة لمن يفضّل
 * الحديث المباشر.
 */
export function RequestForm({
  whatsapp,
  whatsappMessage,
}: {
  whatsapp: string;
  whatsappMessage: string;
}) {
  const t = useTranslations('requestForm');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [reference, setReference] = useState<string | null>(null);

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
    'website', 'mobile', 'desktop', 'system', 'existing', 'api', 'hosting', 'consulting',
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

  // وحدات النطاق — بطاقات غنية بعنوان ووصف بدل مربّعات اختيار مجرّدة
  const modules = ['marketing_site', 'dashboard', 'members', 'blog', 'store', 'pwa'].map(
    (key) => ({ key, title: t(`module.${key}.title`), desc: t(`module.${key}.desc`) }),
  );

  const STEPS = 4;
  // كل الحقول اختيارية — لا نمنع الانتقال بين الخطوات ولا الإرسال
  const canProceed = true;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post<{ reference_code: string }>(
        '/project-requests/submit/',
        { ...form, preferred_language: locale },
      );
      setReference(data.reference_code);
    } catch (caught) {
      const payload = toApiError(caught);
      setError(payload);
      // ينقل المستخدم إلى خطوة الحقل الفاشل (بيانات التواصل)
      if (payload.errors.name || payload.errors.email) setStep(4);
    } finally {
      setSubmitting(false);
    }
  }

  const waLink = whatsapp ? whatsappLink(whatsapp, whatsappMessage) : '';

  // شاشة النجاح
  if (reference) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-success/15">
          <Check className="size-7 text-success" aria-hidden="true" />
        </span>
        <h2 className="text-h2 font-semibold">{t('successTitle')}</h2>
        <p className="mx-auto mt-3 max-w-prose text-muted">{t('successBody')}</p>
        <p className="mt-4 inline-block rounded-lg bg-surface-hover px-4 py-2 text-sm">
          {t('reference')}: <strong dir="ltr">{reference}</strong>
        </p>
      </div>
    );
  }

  const selectedFeatureCount = Object.values(form.requirements).filter(Boolean).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start">
      <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      {/* مؤشر الخطوات — بأرقام وتسميات */}
      <ol className="mb-8 flex items-center gap-2" aria-label={t('steps')}>
        {(['type', 'scope', 'budget', 'contact'] as const).map((name, position) => {
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
                  'hidden text-xs font-medium sm:block',
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

      {error && !error.errors.name && !error.errors.email ? (
        <div role="alert" className="mb-4 rounded border border-danger/40 bg-danger/10 p-3 text-sm">
          {error.detail}
        </div>
      ) : null}

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
        <Fieldset legend={t('step1Title')}>
          <ChoiceGrid
            label={t('projectTypeLabel')}
            options={projectTypes}
            value={form.project_type}
            onChange={(value) => set('project_type', value)}
          />
          <SelectField
            label={t('sectorLabel')}
            options={sectors}
            value={form.sector}
            onChange={(value) => set('sector', value)}
            placeholder={t('sectorPlaceholder')}
          />
        </Fieldset>
      ) : null}

      {step === 2 ? (
        <Fieldset legend={t('step2Title')}>
          <fieldset>
            <legend className="mb-1 text-h3 font-semibold">{t('scopeLabel')}</legend>
            <p className="mb-4 text-sm text-muted">{t('scopeHelp')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
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
                      className="mt-0.5 size-4"
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

          <TextArea
            label={t('detailsLabel')}
            value={form.description}
            onChange={(value) => set('description', value)}
            placeholder={t('descriptionPlaceholder')}
          />
        </Fieldset>
      ) : null}

      {step === 3 ? (
        <Fieldset legend={t('step3Title')}>
          <ChoiceGrid
            label={t('budgetSectionLabel')}
            options={budgets}
            value={form.budget_range}
            onChange={(value) => set('budget_range', value)}
          />
          <p className="-mt-3 text-xs text-muted">{t('budgetHelp')}</p>
          <ChoiceGrid
            label={t('timelineLabel')}
            options={timelines}
            value={form.timeline}
            onChange={(value) => set('timeline', value)}
          />
        </Fieldset>
      ) : null}

      {step === 4 ? (
        <Fieldset legend={t('step4Title')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('nameLabel')}
              value={form.name}
              onChange={(value) => set('name', value)}
              error={error ? fieldError(error, 'name') : undefined}
            />
            <TextField
              label={t('emailLabel')}
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(value) => set('email', value)}
              error={error ? fieldError(error, 'email') : undefined}
            />
            <TextField
              label={t('phoneLabel')}
              type="tel"
              dir="ltr"
              value={form.phone}
              onChange={(value) => set('phone', value)}
            />
            <TextField
              label={t('companyLabel')}
              value={form.company}
              onChange={(value) => set('company', value)}
            />
          </div>
        </Fieldset>
      ) : null}

      {/* التنقّل */}
      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((current) => current - 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 text-sm hover:bg-surface-hover"
          >
            {locale === 'ar' ? (
              <ArrowRight className="size-4" aria-hidden="true" />
            ) : (
              <ArrowLeft className="size-4" aria-hidden="true" />
            )}
            {t('back')}
          </button>
        ) : (
          <span />
        )}

        {step < STEPS ? (
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => setStep((current) => current + 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t('next')}
            {locale === 'ar' ? (
              <ArrowLeft className="size-4" aria-hidden="true" />
            ) : (
              <ArrowRight className="size-4" aria-hidden="true" />
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canProceed || submitting}
            onClick={submit}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t('submit')}
          </button>
        )}
      </div>

      {/* مخرج واتساب دائم */}
      {waLink ? (
        <div className="mt-6 border-t border-border pt-4 text-center">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-success hover:underline"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {t('preferWhatsapp')}
          </a>
        </div>
      ) : null}
      </div>

      {/* ملخّص حيّ يتحدّث مع اختيارات المستخدم */}
      <aside className="rounded-xl border border-border bg-surface p-6 shadow-subtle lg:sticky lg:top-24">
        <h2 className="mb-4 text-h3 font-semibold">{t('summaryTitle')}</h2>

        {form.project_type ? (
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t('summaryType')}</dt>
              <dd className="font-medium">
                {projectTypes.find((option) => option.value === form.project_type)?.label}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t('summaryFeatures')}</dt>
              <dd className="code-inline font-medium">
                {t('summaryCount', {
                  count: selectedFeatureCount,
                  total: modules.length,
                })}
              </dd>
            </div>
            {form.budget_range ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">{t('budgetLabel')}</dt>
                <dd className="font-medium">
                  {budgets.find((option) => option.value === form.budget_range)?.label}
                </dd>
              </div>
            ) : null}
            {form.timeline ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">{t('timelineLabel')}</dt>
                <dd className="font-medium">
                  {timelines.find((option) => option.value === form.timeline)?.label}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-muted">{t('summaryPlaceholder')}</p>
        )}

        <p className="mt-5 flex items-center gap-2 rounded-lg bg-success-soft p-3 text-sm text-success">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          {t('replyPromise')}
        </p>
      </aside>
    </div>
  );
}

// --------------------------------------------------------------- عناصر مساعدة

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-h3 font-semibold">{legend}</h2>
      {children}
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
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'min-h-11 rounded border px-3 text-sm transition-colors',
              value === option.value
                ? 'border-primary bg-primary/10 font-medium text-primary'
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
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
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
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  dir?: 'ltr' | 'rtl';
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <input
        type={type}
        dir={dir}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={cn(
          'min-h-11 w-full rounded border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring',
          error ? 'border-danger' : 'border-border',
          dir === 'ltr' && 'text-start',
        )}
      />
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-24 w-full rounded border border-border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
