'use client';

import { usersConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';

export default function UsersAdminPage() {
  return <ResourcePage config={usersConfig} />;
}
