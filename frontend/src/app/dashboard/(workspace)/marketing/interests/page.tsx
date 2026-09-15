'use client';

import { interestsConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function InterestsPage() {
  return <ResourcePage config={interestsConfig} />;
}
