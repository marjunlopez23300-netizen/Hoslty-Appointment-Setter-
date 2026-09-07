create extension if not exists pgcrypto;
create table if not exists leads (id uuid primary key default gen_random_uuid(), full_name text not null, email text not null, mobile text not null, service_type text not null, qualification_status text not null default 'NURTURE', crm_status text not null default 'NEW_LEAD', manual_label text not null default 'NONE', preferred_location text, budget_range text, start_timeframe text, answers jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists consultations (id uuid primary key default gen_random_uuid(), lead_id uuid not null references leads(id) on delete cascade, requested_datetime timestamptz not null, approved_datetime timestamptz, duration_minutes int not null default 30, status text not null default 'PENDING_APPROVAL', meeting_provider text, meeting_url text, admin_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists leads_service_type_idx on leads(service_type);
create index if not exists consultations_requested_datetime_idx on consultations(requested_datetime);
alter table leads enable row level security;
alter table consultations enable row level security;
