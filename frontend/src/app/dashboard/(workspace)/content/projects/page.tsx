'use client';

import { projectsConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function ProjectsAdminPage() {
  return <ResourcePage config={projectsConfig} />;
}
