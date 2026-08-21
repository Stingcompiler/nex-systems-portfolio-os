'use client';

import { processStepsConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function ProcessAdminPage() {
  return <ResourcePage config={processStepsConfig} />;
}
