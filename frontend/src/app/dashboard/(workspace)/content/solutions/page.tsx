'use client';

import { solutionsConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function SolutionsAdminPage() {
  return <ResourcePage config={solutionsConfig} />;
}
