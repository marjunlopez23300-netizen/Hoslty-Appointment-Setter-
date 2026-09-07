import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../lib/supabase/admin';

export const runtime = 'nodejs';

const serviceTypes: Record<string, string> = {
  management: 'PROPERTY_MANAGEMENT',
  build: 'AIRBNB_PLANNING_BUILD',
  arbitrage: 'RENTAL_ARBITRAGE',
  investment: 'INVESTMENT_PARTNERSHIP',
  systems: 'CUSTOM_SYSTEM_WEB_APP',
};

type ConsultationRequest = {
  fullName?: string;
  email?: string;
  mobile?: string;
  serviceId?: string;
  primaryAnswer?: string;
  location?: string;
  timeframe?: string;
  requestedAt?: string;
  marketingConsent?: boolean;
};

function qualificationFor(body: ConsultationRequest) {
  if (body.timeframe === 'Just exploring') return 'NURTURE';
  const soon = body.timeframe === 'ASAP' || body.timeframe === 'Within 30 days';
  const readyCapital = body.serviceId === 'investment' ||
    (body.serviceId === 'arbitrage' && body.primaryAnswer !== 'Below ₱100k');
  return soon && readyCapital ? 'HIGH_PRIORITY' : 'FOLLOW_UP_PRIORITY';
}

export async function POST(request: Request) {
  let body: ConsultationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const fullName = body.fullName?.trim();
  const email = body.email?.trim().toLowerCase();
  const mobile = body.mobile?.trim();
  const serviceType = body.serviceId ? serviceTypes[body.serviceId] : undefined;
  const requestedAt = body.requestedAt ? new Date(body.requestedAt) : null;

  if (!fullName || fullName.length > 120 || !email || !/^\S+@\S+\.\S+$/.test(email) ||
      !mobile || mobile.length < 7 || mobile.length > 40 || !serviceType ||
      !body.primaryAnswer || !body.location?.trim() || !body.timeframe ||
      !requestedAt || Number.isNaN(requestedAt.getTime())) {
    return NextResponse.json({ error: 'Please complete every required field.' }, { status: 400 });
  }

  if (requestedAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Please choose a future consultation time.' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const qualificationStatus = qualificationFor(body);
  const now = new Date().toISOString();
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert({
      full_name: fullName,
      email,
      mobile,
      service_type: serviceType,
      qualification_status: qualificationStatus,
      crm_status: 'CONSULTATION_REQUESTED',
      preferred_location: body.location.trim(),
      budget_range: ['arbitrage', 'investment'].includes(body.serviceId!) ? body.primaryAnswer : null,
      start_timeframe: body.timeframe,
      marketing_consent: body.marketingConsent === true,
      marketing_consent_at: body.marketingConsent === true ? now : null,
      source: 'WEBSITE',
    })
    .select('id')
    .single();

  if (leadError || !lead) {
    console.error('Lead insert failed', leadError?.code);
    return NextResponse.json({ error: 'We could not save your request. Please try again.' }, { status: 500 });
  }

  const [answersResult, consultationResult] = await Promise.all([
    supabase.from('lead_answers').insert({
      lead_id: lead.id,
      service_type: serviceType,
      answers: {
        primary_answer: body.primaryAnswer,
        preferred_location: body.location.trim(),
        start_timeframe: body.timeframe,
      },
    }),
    supabase.from('consultations').insert({
      lead_id: lead.id,
      requested_datetime: requestedAt.toISOString(),
      duration_minutes: 30,
      status: 'PENDING_APPROVAL',
    }).select('id').single(),
  ]);

  if (answersResult.error || consultationResult.error) {
    await supabase.from('leads').delete().eq('id', lead.id);
    const conflict = consultationResult.error?.code === '23505';
    return NextResponse.json(
      { error: conflict ? 'That time was just requested. Please choose another slot.' : 'We could not complete your request. Please try again.' },
      { status: conflict ? 409 : 500 },
    );
  }

  return NextResponse.json({
    consultationId: consultationResult.data.id,
    status: 'PENDING_APPROVAL',
  }, { status: 201 });
}
