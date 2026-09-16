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
        border: 'rgb(var(--border) / <alpha-value>)',
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
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        // مقياس بنسبة ~1.4–1.5 بين المستويات لا ~1.2: القفزة الصغيرة كانت
        // تُسطّح الصفحة بعد البطل، فيبدو عنوان القسم بحجم عنوان البطاقة.
        // عنوان البطل وحده يقرأ --line-height-display: العربية بأربعة أسطر
        // تحتاج سطرًا أضيق من باقي العناوين وإلا تفكّكت الكتلة.
        // الحدّ الأعلى 72px مع عمود بطل بعرض 1.1fr يحافظ على أربعة أسطر على 1280.
        display: [
          'clamp(2.75rem, 4.5vw + 1rem, 4.5rem)',
          { lineHeight: 'var(--line-height-display)' },
        ],
        // بلا lineHeight — القاعدة في globals.css تقرأ var(--line-height-heading)
        h1: 'clamp(2.25rem, 3.5vw + 1rem, 3.25rem)',
        h2: 'clamp(1.875rem, 2.5vw + 0.875rem, 2.75rem)',
        h3: 'clamp(1.25rem, 1vw + 0.75rem, 1.5rem)',
        // مقدمات الأقسام ووصف البطاقات — 17px بدل 14px: نص المتصفّح لا حاشية
        'body-lg': ['1.125rem', { lineHeight: 'var(--line-height-body)' }],
        // التسميات الصغيرة (شارات، تواريخ، عناوين أعمدة) — بدل text-xs/text-sm العشوائي
        label: ['0.8125rem', { lineHeight: '1.5' }],
        // سطر الجذب فوق عناوين الأقسام — مونو صغير متباعد الأحرف
        eyebrow: ['0.75rem', { lineHeight: '1', letterSpacing: '0.12em' }],
      },
      maxWidth: {
        content: '80rem',
        prose: '72ch',
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.625rem',
        lg: '0.875rem',
        xl: '1.25rem',
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
