'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, MessageSquarePlus, Phone, UserCheck, X } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import {
  crmDateTime,
  INTERACTION_TYPES,
  LEAD_STATUSES,
  PRIORITIES,
} from '@/features/dashboard/crm/shared';
import { api, toApiError } from '@/lib/api/client';

interface LeadDetail {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  status: string;
  priority: string;
  expected_budget: string;
  notes: string;
  has_client: boolean;
  first_contact_at: string | null;
  last_contact_at: string | null;
}

interface Note {
  id: number;
  content: string;
  created_by_name: string;
  created_at: string;
}

interface Interaction {
  id: number;
  type: string;
  type_display: string;
  direction: string;
  summary: string;
  occurred_at: string;
}

export function LeadDetailDrawer({
  leadId,
  onClose,
}: {
  leadId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [noteText, setNoteText] = useState('');
  const [interactionType, setInteractionType] = useState('call');
  const [interactionSummary, setInteractionSummary] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
  };

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => (await api.get<LeadDetail>(`/leads/${leadId}/`)).data,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['lead', leadId, 'notes'],
    queryFn: async () => {
      const { data } = await api.get<{ results: Note[] }>('/crm/notes/', {
        params: { lead: leadId, page_size: 50 },
      });
      return data.results;
    },
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['lead', leadId, 'interactions'],
    queryFn: async () => {
      const { data } = await api.get<{ results: Interaction[] }>('/crm/interactions/', {
        params: { lead: leadId, page_size: 50 },
      });
      return data.results;
    },
  });

  const updateField = useMutation({
    mutationFn: (payload: Partial<LeadDetail>) => api.patch(`/leads/${leadId}/`, payload),
    onSuccess: invalidate,
    onError: (error) => toast.error(toApiError(error).detail),
  });

  const addNote = useMutation({
    mutationFn: () => api.post('/crm/notes/', { lead: leadId, content: noteText }),
    onSuccess: () => {
      setNoteText('');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId, 'notes'] });
      toast.success('أُضيفت الملاحظة');
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  const addInteraction = useMutation({
    mutationFn: () =>
      api.post('/crm/interactions/', {
        lead: leadId,
        type: interactionType,
        direction: 'outbound',
        summary: interactionSummary,
      }),
    onSuccess: () => {
      setInteractionSummary('');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId, 'interactions'] });
      invalidate();
      toast.success('سُجّل التواصل');
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  const convert = useMutation({
    mutationFn: () => api.post(`/leads/${leadId}/convert/`),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('حُوّل إلى عميل');
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="تفاصيل العميل المحتمل"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-dvh w-full max-w-lg flex-col border-s border-border bg-surface">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 className="flex-1 text-h3 font-semibold">{lead?.name ?? '…'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="inline-flex size-9 items-center justify-center rounded text-muted hover:bg-surface-hover"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {isLoading || !lead ? (
          <div className="grid flex-1 place-items-center text-muted" role="status">
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          </div>
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto p-4">
            {/* الحالة والأولوية والتحويل */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={lead.status}
                onChange={(event) => updateField.mutate({ status: event.target.value })}
                aria-label="الحالة"
                className="min-h-11 rounded border border-border bg-background px-3 text-sm"
              >
                {LEAD_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <select
                value={lead.priority}
                onChange={(event) => updateField.mutate({ priority: event.target.value })}
                aria-label="الأولوية"
                className="min-h-11 rounded border border-border bg-background px-3 text-sm"
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>

              {!lead.has_client ? (
                <button
                  type="button"
                  onClick={() => convert.mutate()}
                  disabled={convert.isPending}
                  className="inline-flex min-h-11 items-center gap-2 rounded bg-success px-4 text-sm font-medium text-white disabled:opacity-60"
                >
                  <UserCheck className="size-4" aria-hidden="true" />
                  تحويل إلى عميل
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded bg-success/15 px-3 py-2 text-sm text-success">
                  <UserCheck className="size-4" aria-hidden="true" />
                  عميل
                </span>
              )}
            </div>

            {/* معلومات التواصل */}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="البريد" value={lead.email} dir="ltr" />
              <Detail label="الهاتف" value={lead.phone} dir="ltr" />
              <Detail label="الشركة" value={lead.company} />
              <Detail label="الميزانية" value={lead.expected_budget} />
              <Detail label="أول تواصل" value={crmDateTime(lead.first_contact_at)} />
              <Detail label="آخر تواصل" value={crmDateTime(lead.last_contact_at)} />
            </dl>

            {/* تسجيل تواصل */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Phone className="size-4" aria-hidden="true" />
                سجل التواصل
              </h3>
              <div className="mb-3 flex gap-2">
                <select
                  value={interactionType}
                  onChange={(event) => setInteractionType(event.target.value)}
                  aria-label="نوع التواصل"
                  className="min-h-11 rounded border border-border bg-background px-2 text-sm"
                >
                  {INTERACTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={interactionSummary}
                  onChange={(event) => setInteractionSummary(event.target.value)}
                  placeholder="ملخص التواصل"
                  className="min-h-11 flex-1 rounded border border-border bg-background px-3 text-sm"
                />
                <button
                  type="button"
                  disabled={!interactionSummary.trim() || addInteraction.isPending}
                  onClick={() => addInteraction.mutate()}
                  className="inline-flex min-h-11 items-center rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  تسجيل
                </button>
              </div>
              <ul className="space-y-2">
                {interactions.map((item) => (
                  <li key={item.id} className="rounded border border-border p-2 text-sm">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>{item.type_display}</span>
                      <time>{crmDateTime(item.occurred_at)}</time>
                    </div>
                    <p className="mt-1">{item.summary}</p>
                  </li>
                ))}
                {!interactions.length ? (
                  <li className="text-sm text-muted">لا تواصل مسجَّل بعد.</li>
                ) : null}
              </ul>
            </section>

            {/* الملاحظات */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <MessageSquarePlus className="size-4" aria-hidden="true" />
                الملاحظات
              </h3>
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="أضف ملاحظة"
                  className="min-h-11 flex-1 rounded border border-border bg-background px-3 text-sm"
                />
                <button
                  type="button"
                  disabled={!noteText.trim() || addNote.isPending}
                  onClick={() => addNote.mutate()}
                  className="inline-flex min-h-11 items-center rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  إضافة
                </button>
              </div>
              <ul className="space-y-2">
                {notes.map((note) => (
                  <li key={note.id} className="rounded border border-border p-2 text-sm">
                    <p>{note.content}</p>
                    <p className="mt-1 text-xs text-muted">
                      {note.created_by_name} — {crmDateTime(note.created_at)}
                    </p>
                  </li>
                ))}
                {!notes.length ? (
                  <li className="text-sm text-muted">لا ملاحظات بعد.</li>
                ) : null}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd dir={dir} className={dir === 'ltr' ? 'text-start' : undefined}>
        {value || '—'}
      </dd>
    </div>
  );
}
