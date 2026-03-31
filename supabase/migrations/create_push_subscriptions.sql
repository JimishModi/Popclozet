-- Migration: create push_subscriptions table
-- Stores Web Push API subscriptions per user device.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  updated_at  timestamptz not null default now(),

  -- One subscription per (user, device endpoint)
  unique (user_id, endpoint)
);

-- Index for fast lookups when sending notifications
create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- RLS: users can only manage their own subscriptions
alter table public.push_subscriptions enable row level security;

create policy "Users can manage their own push subscriptions"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role (used by the edge function) bypasses RLS automatically
