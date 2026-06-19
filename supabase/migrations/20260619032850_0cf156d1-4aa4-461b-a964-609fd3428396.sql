
-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'user');

create type public.subscription_status as enum (
  'pending', 'active', 'past_due', 'canceled', 'refunded'
);

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  owner_name text,
  company_fantasy_name text,
  company_legal_name text,
  company_cnpj text unique,
  company_email text,
  company_phone text,
  default_margin_pct numeric(5,2) not null default 30.00,
  accepted_terms_version text,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Users select own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Trigger: criar profile ao criar user, copiando metadata do signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, owner_name, company_fantasy_name, company_legal_name,
    company_cnpj, company_email, company_phone, accepted_terms_version, accepted_terms_at
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'owner_name',''),
    nullif(new.raw_user_meta_data->>'company_fantasy_name',''),
    nullif(new.raw_user_meta_data->>'company_legal_name',''),
    nullif(new.raw_user_meta_data->>'company_cnpj',''),
    nullif(new.raw_user_meta_data->>'company_email',''),
    nullif(new.raw_user_meta_data->>'company_phone',''),
    '2026-06-01',
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Users read own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- ============ SUBSCRIPTIONS ============
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider text not null default 'abacatepay',
  customer_id text,
  subscription_id text,
  billing_id text,
  status public.subscription_status not null default 'pending',
  amount_cents integer not null default 11900,
  monthly_contract_quota integer not null default 200,
  current_period_end timestamptz,
  last_payment_at timestamptz,
  cancel_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_status_idx on public.subscriptions(status);
create index subscriptions_customer_idx on public.subscriptions(customer_id);

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

create policy "Users read own subscription"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at_column();

create or replace function public.has_active_subscription(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = _user_id
      and status = 'active'
      and (current_period_end is null or current_period_end > now())
  )
$$;

-- Quota: contratos do mês corrente do usuário logado
create or replace function public.current_month_contract_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.contracts
  where user_id = auth.uid()
    and created_at >= date_trunc('month', now());
$$;

-- ============ WEBHOOK EVENTS (idempotência) ============
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

grant all on public.webhook_events to service_role;
alter table public.webhook_events enable row level security;
-- sem policies: somente service_role acessa

-- ============ RATE LIMITS ============
create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index rate_limits_lookup_idx on public.rate_limits(user_id, action, created_at desc);

grant all on public.rate_limits to service_role;
alter table public.rate_limits enable row level security;
-- sem policies: somente service_role acessa
