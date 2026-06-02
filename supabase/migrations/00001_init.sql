-- Tellodb Platform: Full Schema (run in Supabase SQL Editor)

-- 0. Core tables (must exist first)
create table if not exists public.clusters (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  tier text not null default 'fractional',
  status text not null default 'provisioning',
  endpoint_url text not null default '',
  region text not null default '',
  engine_key text,
  storage_gb integer default 50,
  created_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  key_value text not null,
  cluster_id uuid references public.clusters(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- 1. Teams
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.invitations (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- 2. Subscriptions (Stripe)
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  tier text not null default 'fractional',
  status text not null default 'incomplete',
  token_balance bigint not null default 10000,
  free_tokens_granted_at timestamptz not null default now(),
  vm_size text,
  vm_monthly_price numeric(10, 2),
  storage_gb integer default 10,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Daily usage rollups
create table if not exists public.usage_daily (
  id uuid default gen_random_uuid() primary key,
  cluster_id uuid references public.clusters(id) on delete cascade not null,
  date date not null,
  request_count integer not null default 0,
  ingest_count integer not null default 0,
  query_count integer not null default 0,
  graph_ops integer not null default 0,
  storage_bytes bigint not null default 0,
  unique(cluster_id, date)
);

-- 4. Context Templates
create table if not exists public.context_templates (
  id uuid default gen_random_uuid() primary key,
  cluster_id uuid references public.clusters(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  name text not null,
  template text not null,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Connector Configs
create table if not exists public.connector_configs (
  id uuid default gen_random_uuid() primary key,
  cluster_id uuid references public.clusters(id) on delete cascade not null,
  connector_type text not null,
  credentials jsonb not null default '{}',
  config jsonb not null default '{}',
  last_sync_at timestamptz,
  status text default 'active',
  created_at timestamptz default now()
);

-- 6. Rate limit tracking
create table if not exists public.rate_limits (
  cluster_id uuid references public.clusters(id) on delete cascade primary key,
  rpm_used integer default 0,
  rpm_reset_at timestamptz,
  daily_used integer default 0,
  daily_reset_at timestamptz
);

-- 7. Purchases (transaction history)
create table if not exists public.purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric(10, 2) not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.clusters enable row level security;
alter table public.api_keys enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_daily enable row level security;
alter table public.context_templates enable row level security;
alter table public.connector_configs enable row level security;
alter table public.purchases enable row level security;

-- Policies
drop policy if exists "Users can read their clusters" on public.clusters;
create policy "Users can read their clusters" on public.clusters for select using (user_id = auth.uid());

drop policy if exists "Users can insert their clusters" on public.clusters;
create policy "Users can insert their clusters" on public.clusters for insert with check (user_id = auth.uid());

drop policy if exists "Users can update their clusters" on public.clusters;
create policy "Users can update their clusters" on public.clusters for update using (user_id = auth.uid());

drop policy if exists "Users can read their api keys" on public.api_keys;
create policy "Users can read their api keys" on public.api_keys for select using (user_id = auth.uid());

drop policy if exists "Users can insert their api keys" on public.api_keys;
create policy "Users can insert their api keys" on public.api_keys for insert with check (user_id = auth.uid());

drop policy if exists "Users can delete their api keys" on public.api_keys;
create policy "Users can delete their api keys" on public.api_keys for delete using (user_id = auth.uid());

drop policy if exists "Users can read their teams" on public.teams;
create policy "Users can read their teams" on public.teams for select using (id in (select team_id from public.team_members where user_id = auth.uid()));

drop policy if exists "Members can read team members" on public.team_members;
create policy "Members can read team members" on public.team_members for select using (team_id in (select team_id from public.team_members where user_id = auth.uid()));

drop policy if exists "Users can read own subscriptions" on public.subscriptions;
create policy "Users can read own subscriptions" on public.subscriptions for select using (user_id = auth.uid());

drop policy if exists "Owners can read cluster usage" on public.usage_daily;
create policy "Owners can read cluster usage" on public.usage_daily for select using (cluster_id in (select id from public.clusters where user_id = auth.uid()));

drop policy if exists "Owners can manage templates" on public.context_templates;
create policy "Owners can manage templates" on public.context_templates for all using (cluster_id in (select id from public.clusters where user_id = auth.uid()));

drop policy if exists "Owners can manage connectors" on public.connector_configs;
create policy "Owners can manage connectors" on public.connector_configs for all using (cluster_id in (select id from public.clusters where user_id = auth.uid()));

drop policy if exists "Users can read own purchases" on public.purchases;
create policy "Users can read own purchases" on public.purchases for select using (user_id = auth.uid());

-- Auto-create personal team on signup
create or replace function public.handle_new_user() returns trigger as $$
declare team_id uuid;
begin
  insert into public.teams (name) values (coalesce(new.raw_user_meta_data->>'name', new.email) || '''s Team') returning id into team_id;
  insert into public.team_members (team_id, user_id, role) values (team_id, new.id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RPC Function for decrementing token/truth balances
create or replace function public.decrement_token_balance(uid uuid, amount bigint)
returns bigint as $$
declare
  new_balance bigint;
begin
  update public.subscriptions
  set token_balance = greatest(0, token_balance - amount),
      updated_at = now()
  where user_id = uid
  returning token_balance into new_balance;
  return coalesce(new_balance, -1);
end;
$$ language plpgsql security definer;

-- Ensure subscriptions.user_id has a unique constraint (required for upsert onConflict)
create unique index if not exists subscriptions_user_id_unique on public.subscriptions(user_id);
