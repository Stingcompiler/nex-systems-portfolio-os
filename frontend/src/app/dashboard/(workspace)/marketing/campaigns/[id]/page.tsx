'use client';

import { useParams } from 'next/navigation';

import { CampaignEditor } from '@/features/dashboard/marketing/campaign-editor';

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  return <CampaignEditor id={Number(params.id)} />;
}
