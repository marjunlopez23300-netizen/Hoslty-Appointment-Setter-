-- Hostly Solutions / Supabase schema
-- Run in the Supabase SQL Editor on a new project.
-- Public forms should write through validated server-side handlers using the
-- service-role/secret key. Never expose that key in browser code.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

do $$ begin
  create type public.user_role as enum ('OWNER', 'ADMIN', 'APPOINTMENT_SETTER', 'SALES_CLOSER');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.user_status as enum ('ACTIVE', 'INVITED', 'SUSPENDED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.service_type as enum ('PROPERTY_MANAGEMENT', 'AIRBNB_PLANNING_BUILD', 'RENTAL_ARBITRAGE', 'INVESTMENT_PARTNERSHIP', 'CUSTOM_SYSTEM_WEB_APP');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.qualification_status as enum ('HIGH_PRIORITY', 'FOLLOW_UP_PRIORITY', 'NURTURE');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.crm_status as enum ('NEW_LEAD', 'QUALIFIED', 'FOLLOW_UP', 'CONSULTATION_REQUESTED', 'PENDING_APPROVAL', 'CONSULTATION_APPROVED', 'RESCHEDULED', 'CONSULTATION_COMPLETED', 'PROPOSAL_DISCUSSION', 'INTERESTED_DEAL', 'CLOSED_WON', 'CLOSED_LOST', 'NURTURE', 'DO_NOT_PURSUE');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.consultation_status as enum ('PENDING_APPROVAL', 'APPROVED', 'RESCHEDULED', 'DECLINED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.availability_exception_type as enum ('BLOCKED', 'CUSTOM_AVAILABLE');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.opportunity_type as enum ('PROJECT_PARTNERSHIP', 'PROPERTY_SUBLEASE', 'INVESTMENT_OPPORTUNITY', 'PROPERTY_MANAGEMENT', 'BUSINESS_PROJECT', 'ALL_OPPORTUNITIES', 'CUSTOM');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.opportunity_status as enum ('DRAFT', 'UPCOMING', 'OPEN', 'CLOSED', 'FULLY_ALLOCATED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.campaign_status as enum ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED', 'FAILED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.recipient_status as enum ('PENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'UNSUBSCRIBED', 'FAILED');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'APPOINTMENT_SETTER',
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null,
  status public.user_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_uidx on public.profiles (lower(email));

create table if not exists public.client_labels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#536F8B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_labels_name_lower_uidx on public.client_labels (lower(name));

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  mobile text not null check (char_length(mobile) between 7 and 40),
  service_type public.service_type not null,
  qualification_status public.qualification_status not null default 'NURTURE',
  qualification_score smallint not null default 0 check (qualification_score between 0 and 100),
  crm_status public.crm_status not null default 'NEW_LEAD',
  manual_label_id uuid references public.client_labels(id) on delete set null,
  preferred_location text,
  budget_range text,
  target_income text,
  start_timeframe text,
  source text not null default 'WEBSITE',
  assigned_to uuid references public.profiles(id) on delete set null,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  unsubscribed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_marketing_consent_time check (marketing_consent = false or marketing_consent_at is not null)
);

create index if not exists leads_service_idx on public.leads (service_type);
create index if not exists leads_qualification_idx on public.leads (qualification_status, created_at desc);
create index if not exists leads_crm_status_idx on public.leads (crm_status, last_activity_at desc);
create index if not exists leads_label_idx on public.leads (manual_label_id) where manual_label_id is not null;
create index if not exists leads_location_lower_idx on public.leads (lower(preferred_location)) where preferred_location is not null;
create index if not exists leads_email_lower_idx on public.leads (lower(email));

create table if not exists public.lead_answers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  service_type public.service_type not null,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, service_type)
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  requested_datetime timestamptz not null,
  approved_datetime timestamptz,
  proposed_datetime timestamptz,
  duration_minutes smallint not null default 30 check (duration_minutes = 30),
  status public.consultation_status not null default 'PENDING_APPROVAL',
  meeting_provider text check (meeting_provider in ('GOOGLE_MEET', 'ZOOM', 'OTHER')),
  meeting_url text,
  calendar_event_id text,
  admin_notes text,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultations_approved_fields check (status <> 'APPROVED' or approved_datetime is not null)
);

create index if not exists consultations_lead_idx on public.consultations (lead_id, created_at desc);
create index if not exists consultations_status_time_idx on public.consultations (status, requested_datetime);
create unique index if not exists consultations_active_slot_uidx
  on public.consultations (requested_datetime)
  where status in ('PENDING_APPROVAL', 'APPROVED');

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null default '19:00',
  end_time time not null default '22:00',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  unique (user_id, day_of_week)
);

create table if not exists public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exception_date date not null,
  start_time time,
  end_time time,
  type public.availability_exception_type not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((start_time is null and end_time is null) or (start_time is not null and end_time is not null and start_time < end_time))
);

create index if not exists availability_exceptions_user_date_idx on public.availability_exceptions (user_id, exception_date);

create table if not exists public.lead_activities (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  activity_type text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_lead_created_idx on public.lead_activities (lead_id, created_at desc);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type public.opportunity_type not null,
  description text not null,
  location text,
  minimum_capital numeric(14,2) check (minimum_capital is null or minimum_capital >= 0),
  available_slots integer check (available_slots is null or available_slots >= 0),
  status public.opportunity_status not null default 'DRAFT',
  open_at timestamptz,
  close_at timestamptz,
  target_audience jsonb not null default '{}'::jsonb,
  cta_label text,
  cta_url text,
  attachment_url text,
  image_url text,
  contact_person text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (close_at is null or open_at is null or close_at > open_at)
);

create index if not exists opportunities_status_dates_idx on public.opportunities (status, open_at, close_at);

create table if not exists public.opportunity_subscriptions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  opportunity_type public.opportunity_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, opportunity_type)
);

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  audience_filter jsonb not null default '{}'::jsonb,
  subject text not null,
  body_html text,
  body_text text not null,
  cta_text text,
  cta_url text,
  image_url text,
  status public.campaign_status not null default 'DRAFT',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_campaigns_status_schedule_idx on public.email_campaigns (status, scheduled_at);

create table if not exists public.email_campaign_recipients (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status public.recipient_status not null default 'PENDING',
  provider_message_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  error_message text,
  unique (campaign_id, lead_id)
);

create index if not exists campaign_recipients_status_idx on public.email_campaign_recipients (campaign_id, status);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc) where actor_id is not null;

create or replace function private.is_hostly_staff()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') in ('OWNER', 'ADMIN', 'APPOINTMENT_SETTER', 'SALES_CLOSER'), false)
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','client_labels','leads','lead_answers','consultations','availability',
    'availability_exceptions','opportunities','opportunity_subscriptions','email_campaigns'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name);
  end loop;
end $$;

insert into public.client_labels (name, color, is_system, sort_order) values
  ('Interested Deal', '#0B2C52', true, 10),
  ('Priority', '#536F8B', true, 20),
  ('Follow Up', '#D69E2E', true, 30),
  ('Do Not Pursue', '#C53030', true, 40)
on conflict do nothing;

-- Data API access is explicit. Anonymous clients cannot read or write PII.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public, private to authenticated;
grant execute on function private.is_hostly_staff() to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Enable RLS on every exposed table.
alter table public.profiles enable row level security;
alter table public.client_labels enable row level security;
alter table public.leads enable row level security;
alter table public.lead_answers enable row level security;
alter table public.consultations enable row level security;
alter table public.availability enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.lead_activities enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_subscriptions enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;
alter table public.audit_logs enable row level security;

-- A signed-in user can see their own profile. Only staff can change profiles.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.is_hostly_staff()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using ((select private.is_hostly_staff()))
with check ((select private.is_hostly_staff()));

-- Staff-only policies for CRM and operational tables.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'client_labels','leads','lead_answers','consultations','availability',
    'availability_exceptions','lead_activities','opportunities','opportunity_subscriptions',
    'email_campaigns','email_campaign_recipients','audit_logs'
  ] loop
    execute format('drop policy if exists staff_select on public.%I', table_name);
    execute format('create policy staff_select on public.%I for select to authenticated using ((select private.is_hostly_staff()))', table_name);
    execute format('drop policy if exists staff_insert on public.%I', table_name);
    execute format('create policy staff_insert on public.%I for insert to authenticated with check ((select private.is_hostly_staff()))', table_name);
    execute format('drop policy if exists staff_update on public.%I', table_name);
    execute format('create policy staff_update on public.%I for update to authenticated using ((select private.is_hostly_staff())) with check ((select private.is_hostly_staff()))', table_name);
    execute format('drop policy if exists staff_delete on public.%I', table_name);
    execute format('create policy staff_delete on public.%I for delete to authenticated using ((select private.is_hostly_staff()))', table_name);
  end loop;
end $$;

commit;
