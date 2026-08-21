'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export interface CommentReply {
  id: number;
  author_name: string;
  content: string;
  is_mine: boolean;
  created_at: string;
}

export interface Comment extends CommentReply {
  replies: CommentReply[];
}

interface CreatePayload {
  post: number;
  parent?: number | null;
  content: string;
  guest_name?: string;
  guest_email?: string;
  notify_on_reply?: boolean;
  website: string;
  elapsed_seconds: number;
}

export function useComments(postSlug: string) {
  return useQuery({
    queryKey: ['comments', postSlug],
    queryFn: async () => {
      const { data } = await api.get<Comment[]>('/comments/', {
        params: { post: postSlug },
      });
      return data;
    },
  });
}

export function useCreateComment(postSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const { data } = await api.post<{ detail: string; id?: number }>(
        '/comments/',
        payload,
      );
      return data;
    },
    onSuccess: () => {
      // التعليق يبدأ قيد المراجعة فلا يظهر فورًا؛ نُبطل مع ذلك تحسّبًا
      queryClient.invalidateQueries({ queryKey: ['comments', postSlug] });
    },
  });
}

export function useReportComment() {
  return useMutation({
    mutationFn: async (payload: { comment: number; reason: string; note?: string }) => {
      const { data } = await api.post('/comments/report/', payload);
      return data;
    },
  });
}
