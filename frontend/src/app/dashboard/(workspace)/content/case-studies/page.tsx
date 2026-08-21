'use client';

import { caseStudiesConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function CaseStudiesAdminPage() {
  return <ResourcePage config={caseStudiesConfig} />;
}
