import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { createSupabaseAdmin } from '../../../../../lib/supabase/admin';

export const runtime = 'nodejs';

const crmStatuses = [
  'NEW_LEAD','QUALIFIED','FOLLOW_UP','CONSULTATION_REQUESTED','PENDING_APPROVAL',
  'CONSULTATION_APPROVED','RESCHEDULED','CONSULTATION_COMPLETED','PROPOSAL_DISCUSSION',
  'INTERESTED_DEAL','CLOSED_WON','CLOSED_LOST','NURTURE','DO_NOT_PURSUE',
] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json() as { crmStatus?: string };
  const crmStatus = String(body.crmStatus || '');
  if (!crmStatuses.includes(crmStatus as typeof crmStatuses[number])) {
    return NextResponse.json({ error: 'Invalid CRM stage.' }, { status: 400 });
  }

  const { data, error } = await createSupabaseAdmin().from('leads').update({
    crm_status: crmStatus,
    last_activity_at: new Date().toISOString(),
  }).eq('id', id).select('id,crm_status,last_activity_at').single();

  if (error || !data) return NextResponse.json({ error: 'Unable to update lead.' }, { status: 500 });
  return NextResponse.json({ lead: data });
}
