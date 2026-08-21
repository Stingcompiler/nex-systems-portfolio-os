'use client';

import { postsConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function PostsAdminPage() {
  return <ResourcePage config={postsConfig} />;
}
