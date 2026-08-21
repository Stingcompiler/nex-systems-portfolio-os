import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * روابط وتنقّل مدركان للغة: `<Link href="/services">` يصبح `/ar/services`
 * تلقائيًا دون كتابة البادئة في كل مكان.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
