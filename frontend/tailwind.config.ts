import type { Config } from 'tailwindcss';

/**
 * كل الألوان تمر عبر متغيرات CSS دلالية معرّفة في globals.css.
 * التغييرات: درجات soft لكل لون دلالي [بند 4]،
 * وحذف lineHeight من مقاييس العناوين ليحكمها --line-height-heading حسب اللغة [بند 1].
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-hover': 'rgb(var(--surface-hover) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        muted: 'rgb(var(--foreground-muted) / <alpha-value>)',
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
          soft: 'rgb(var(--primary-soft) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          soft: 'rgb(var(--success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          soft: 'rgb(var(--warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
        },
        ring: 'rgb(var(--ring) / <alpha-value>)',
        'brand-ink': 'rgb(var(--brand-ink) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        // مقياس Vezano (styles.css في المرجع) — h1 = 28px (25 على الهاتف)،
        // الجسم 16px، البطاقات 13px، الشارات 11–12px — عدا h2/h3 أدناه.
        // `display` هو h1 المرجع مرفوعًا درجة واحدة لعنوان البطل فقط، لأن
        // المرجع لا يملك بطلًا أصلًا؛ يقرأ --line-height-display.
        // بلا letterSpacing هنا: قيمة في الرمز تُطبَّق على العنصر نفسه فتتغلب
        // على `:lang(ar) { letter-spacing: 0 }` الموروثة وتكسر اتصال الحروف
        // العربية (قِيس: -0.64px على عنوان عربي). تباعد المرجع السالب
        // (-0.02em) يُطبَّق في globals.css على :lang(en) فقط.
        display: [
          'clamp(1.75rem, 1.2vw + 1.25rem, 2.25rem)',
          { lineHeight: 'var(--line-height-display)' },
        ],
        // بلا lineHeight — القاعدة في globals.css تقرأ var(--line-height-heading)
        h1: 'clamp(1.5625rem, 0.6vw + 1.35rem, 1.75rem)',
        // h2 و h3 مرفوعان عن المرجع: مقياسه للوحة تحكم مضغوطة، وعلى الموقع
        // كان عنوان البطاقة (14px) أصغر من وصفها (16px) وعنوان القسم (17px)
        // بالكاد فوق الجسم. الآن: قسم 22–24px، بطاقة 18px — تحت h1 (25–28px).
        h2: 'clamp(1.375rem, 0.4vw + 1.25rem, 1.5rem)',
        h3: '1.125rem',
        // مقدمات الأقسام
        'body-lg': ['1rem', { lineHeight: 'var(--line-height-body)' }],
        // نص البطاقات والجداول في المرجع
        card: ['0.8125rem', { lineHeight: '1.55' }],
        // التسميات الصغيرة (شارات، تواريخ، عناوين أعمدة)
        label: ['0.75rem', { lineHeight: '1.5' }],
        // سطر الجذب فوق عناوين الأقسام — بلا تباعد أحرف: يفصل الحروف العربية المتصلة
        eyebrow: ['0.875rem', { lineHeight: '1.25' }],
      },
      maxWidth: {
        content: '80rem',
        prose: '72ch',
      },
      // نصف القطر من المرجع: 10px للأزرار والحقول، 18px للبطاقات واللوحات
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.625rem',
        lg: '0.625rem',
        xl: '1.125rem',
      },
      boxShadow: {
        subtle: 'var(--shadow-sm)',
        card: 'var(--shadow-md)',
        elevated: 'var(--shadow-lg)',
        // الظل الملوّن للعناصر ذات خلفية العلامة (الأزرار، أيقونات الشعار)
        // — كان يُكتب بسبع صيغ يدوية مختلفة
        brand: 'var(--shadow-brand)',
        'brand-lg': 'var(--shadow-brand-lg)',
      },
      backgroundImage: {
        brand: 'var(--gradient-brand)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-reverse': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up var(--duration-normal) ease-out both',
        float: 'float 6s ease-in-out infinite',
        'float-reverse': 'float-reverse 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
