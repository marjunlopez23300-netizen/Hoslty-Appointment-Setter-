import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/admin-auth';
import { createSupabaseAdmin } from '../../../../lib/supabase/admin';

export const runtime = 'nodejs';

const serviceTypes = ['PROPERTY_MANAGEMENT','AIRBNB_PLANNING_BUILD','RENTAL_ARBITRAGE','INVESTMENT_PARTNERSHIP','CUSTOM_SYSTEM_WEB_APP'] as const;

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await createSupabaseAdmin()
    .from('consultations')
    .select('id,requested_datetime,approved_datetime,status,meeting_url,admin_notes,created_at,leads(id,full_name,email,mobile,service_type,qualification_status,preferred_location,budget_range,start_timeframe)')
    .order('requested_datetime', { ascending: true });

  if (error) return NextResponse.json({ error: 'Unable to load consultations.' }, { status: 500 });
  return NextResponse.json({ consultations: data });
}

export async function POST(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const fullName = String(body.fullName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const mobile = String(body.mobile || '').trim();
  const location = String(body.location || '').trim();
  const requestedAt = new Date(String(body.requestedAt || ''));
  const serviceType = String(body.serviceType || '');

  if (fullName.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || mobile.length < 7 ||
      !serviceTypes.includes(serviceType as typeof serviceTypes[number]) || Number.isNaN(requestedAt.getTime())) {
    return NextResponse.json({ error: 'Please complete all required fields.' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: lead, error: leadError } = await supabase.from('leads').insert({
    full_name: fullName, email, mobile, service_type: serviceType,
    qualification_status: 'FOLLOW_UP_PRIORITY', crm_status: 'CONSULTATION_REQUESTED',
    preferred_location: location || null, source: 'ADMIN', marketing_consent: false,
  }).select('id').single();

  if (leadError || !lead) return NextResponse.json({ error: 'Unable to create lead.' }, { status: 500 });
  const { data, error } = await supabase.from('consultations').insert({
    lead_id: lead.id, requested_datetime: requestedAt.toISOString(), status: 'PENDING_APPROVAL', duration_minutes: 30,
  }).select('id').single();

  if (error) {
    await supabase.from('leads').delete().eq('id', lead.id);
    return NextResponse.json({ error: error.code === '23505' ? 'That time is already reserved.' : 'Unable to create consultation.' }, { status: error.code === '23505' ? 409 : 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
