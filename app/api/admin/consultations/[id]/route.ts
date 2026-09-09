import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { createSupabaseAdmin } from '../../../../../lib/supabase/admin';
import { createCalendlySchedulingLink } from '../../../../../lib/calendly';
import { sendHostlyEmail } from '../../../../../lib/email';

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

  if (status === 'APPROVED' || status === 'RESCHEDULED') {
    const lead = current.leads as unknown as { full_name: string; email: string };
    try {
      const singleUseUrl = await createCalendlySchedulingLink();
      const bookingUrl = new URL(singleUseUrl);
      bookingUrl.searchParams.set('name', lead.full_name);
      bookingUrl.searchParams.set('email', lead.email);
      const preferredTime = new Date(requested?.toISOString() || current.requested_datetime).toLocaleString('en-PH', { timeZone:'Asia/Manila', dateStyle:'long', timeStyle:'short' });
      await sendHostlyEmail({
        to: lead.email,
        subject: status === 'RESCHEDULED' ? 'Choose a new time for your Hostly consultation' : 'Your Hostly consultation is approved',
        heading: status === 'RESCHEDULED' ? 'Let’s find another time' : 'Your consultation is approved',
        message: `Hi ${lead.full_name}, your preferred schedule is ${preferredTime}. Please use the private link below to finalize an available time. Calendly will then send your Google Meet and calendar invitation automatically.`,
        actionLabel: 'Confirm schedule in Calendly',
        actionUrl: bookingUrl.toString(),
      });
      changes.calendar_event_id = null;
      changes.meeting_url = bookingUrl.toString();
      changes.meeting_provider = 'OTHER';
    } catch (bookingError) {
      const message = bookingError instanceof Error ? bookingError.message : 'Scheduling email failed.';
      return NextResponse.json({ error: message }, { status: 502 });
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
