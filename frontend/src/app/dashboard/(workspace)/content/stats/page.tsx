'use client';

import { statsConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function StatsAdminPage() {
  return <ResourcePage config={statsConfig} />;
}
