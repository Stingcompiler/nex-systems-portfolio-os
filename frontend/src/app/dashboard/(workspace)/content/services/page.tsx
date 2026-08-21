'use client';

import { servicesConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function ServicesAdminPage() {
  return <ResourcePage config={servicesConfig} />;
}
