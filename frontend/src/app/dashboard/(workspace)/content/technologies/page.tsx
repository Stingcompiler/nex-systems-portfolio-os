'use client';

import { technologiesConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function TechnologiesAdminPage() {
  return <ResourcePage config={technologiesConfig} />;
}
