'use client';

import { faqsConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function FaqAdminPage() {
  return <ResourcePage config={faqsConfig} />;
}
