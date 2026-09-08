import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { createSupabaseAdmin } from '../../../../../lib/supabase/admin';
import { bookCalendlyConsultation } from '../../../../../lib/calendly';

export const runtime = 'nodejs';

const statuses = ['PENDING_APPROVAL','APPROVED','RESCHEDULED','DECLINED','COMPLETED','NO_SHOW','CANCELLED'] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json() as Record<string, unknown>;
  const status = String(body.status || '');
  if (!statuses.includes(status as typeof statuses[number])) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });

  const requested = body.requestedAt ? new Date(String(body.requestedAt)) : null;
  if (requested && Number.isNaN(requested.getTime())) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });

  const changes: Record<string, string | null> = {
    status,
    admin_notes: typeof body.adminNotes === 'string' ? body.adminNotes.trim() || null : null,
  };
  if (requested) changes.requested_datetime = requested.toISOString();
  changes.approved_datetime = status === 'APPROVED' ? (requested?.toISOString() || String(body.currentRequestedAt)) : null;

  const supabase = createSupabaseAdmin();
  const { data: current } = await supabase.from('consultations')
    .select('calendar_event_id,requested_datetime,leads(full_name,email)')
    .eq('id', id).single();
  if (!current) return NextResponse.json({ error: 'Consultation not found.' }, { status: 404 });

  if (status === 'APPROVED' && !current.calendar_event_id) {
    const lead = current.leads as unknown as { full_name: string; email: string };
    try {
      const booking = await bookCalendlyConsultation({
        name: lead.full_name,
        email: lead.email,
        startTime: requested?.toISOString() || current.requested_datetime,
      });
      changes.calendar_event_id = booking.eventUri;
      changes.meeting_url = booking.meetingUrl;
      changes.meeting_provider = 'OTHER';
    } catch (bookingError) {
      const message = bookingError instanceof Error ? bookingError.message : 'Calendly booking failed.';
      return NextResponse.json({ error: `Calendly: ${message}` }, { status: 502 });
    }
  }

  const { data: consultation, error } = await supabase.from('consultations').update(changes).eq('id', id).select('lead_id').single();
  if (error || !consultation) return NextResponse.json({ error: error?.code === '23505' ? 'That time is already reserved.' : 'Unable to update consultation.' }, { status: error?.code === '23505' ? 409 : 500 });

  const crmStatus = status === 'APPROVED' ? 'CONSULTATION_APPROVED' : status === 'COMPLETED' ? 'CONSULTATION_COMPLETED' : status === 'RESCHEDULED' ? 'RESCHEDULED' : status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : undefined;
  if (crmStatus) await supabase.from('leads').update({ crm_status: crmStatus }).eq('id', consultation.lead_id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const supabase = createSupabaseAdmin();
  const { data } = await supabase.from('consultations').select('lead_id').eq('id', id).single();
  if (!data) return NextResponse.json({ error: 'Consultation not found.' }, { status: 404 });
  const { error } = await supabase.from('consultations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Unable to delete consultation.' }, { status: 500 });
  await supabase.from('leads').delete().eq('id', data.lead_id);
  return NextResponse.json({ ok: true });
}
