'use client';

import { api } from '@/lib/api/client';

export interface Interest {
  id: number;
  key: string;
  name: string;
  description: string;
}

export interface SubscriptionPreferences {
  email: string;
  name: string;
  language: 'ar' | 'en';
  interests: string[];
  status: 'pending' | 'active' | 'unsubscribed' | 'bounced' | 'complained' | 'none';
}

export interface SubscribePayload {
  email: string;
  name?: string;
  language: 'ar' | 'en';
  interests: string[];
  source: 'footer' | 'home' | 'blog_post' | 'popup';
  /** حقل خادع — يبقى فارغًا عند البشر */
  website: string;
  elapsed_seconds: number;
}

export async function fetchInterests(lang: string): Promise<Interest[]> {
  const { data } = await api.get<Interest[]>('/interests/', { params: { lang } });
  return data;
}

export async function subscribe(payload: SubscribePayload) {
  const { data } = await api.post<{ detail: string }>('/subscribers/subscribe/', payload);
  return data;
}

export async function confirmSubscription(token: string) {
  const { data } = await api.post<{ detail: string; preferences_token: string }>(
    '/subscribers/confirm/',
    { token },
  );
  return data;
}

export async function unsubscribe(token: string, campaignToken?: string) {
  const { data } = await api.post<{ detail: string }>('/subscribers/unsubscribe/', {
    token,
    campaign_token: campaignToken ?? '',
  });
  return data;
}

export async function fetchPreferences(token: string) {
  const { data } = await api.get<SubscriptionPreferences>(`/subscribers/preferences/${token}/`);
  return data;
}

export async function updatePreferences(
  token: string,
  payload: Partial<Pick<SubscriptionPreferences, 'name' | 'language' | 'interests'>> & {
    resubscribe?: boolean;
  },
) {
  const { data } = await api.patch<SubscriptionPreferences>(
    `/subscribers/preferences/${token}/`,
    payload,
  );
  return data;
}

export async function fetchMySubscription() {
  const { data } = await api.get<SubscriptionPreferences>('/subscribers/me/');
  return data;
}

export async function updateMySubscription(payload: {
  language?: 'ar' | 'en';
  interests?: string[];
}) {
  const { data } = await api.post<SubscriptionPreferences>('/subscribers/me/', payload);
  return data;
}

export async function cancelMySubscription() {
  await api.delete('/subscribers/me/');
}
