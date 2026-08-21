'use client';

import { resourcesConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function ResourcesAdminPage() {
  return <ResourcePage config={resourcesConfig} />;
}
