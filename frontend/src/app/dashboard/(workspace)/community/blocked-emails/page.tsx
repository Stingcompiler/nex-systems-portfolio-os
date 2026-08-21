'use client';

import { blockedEmailsConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function BlockedEmailsPage() {
  return <ResourcePage config={blockedEmailsConfig} />;
}
