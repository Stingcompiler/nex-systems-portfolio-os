'use client';

import { testimonialsConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function TestimonialsAdminPage() {
  return <ResourcePage config={testimonialsConfig} />;
}
