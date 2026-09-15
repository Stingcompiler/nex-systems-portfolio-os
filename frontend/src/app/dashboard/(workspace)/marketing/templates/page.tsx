'use client';

import { emailTemplatesConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function EmailTemplatesPage() {
  return <ResourcePage config={emailTemplatesConfig} />;
}
