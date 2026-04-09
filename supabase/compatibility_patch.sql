alter table public.payments add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.payments add column if not exists status text;
alter table public.payments add column if not exists created_at timestamptz default now();
alter table public.payments add column if not exists updated_at timestamptz default now();
alter table public.payments add column if not exists provider text default 'razorpay';
alter table public.payments add column if not exists razorpay_payment_id text;
alter table public.payments add column if not exists razorpay_order_id text;

update public.payments p
set user_id = o.user_id
from public.orders o
where p.order_id = o.id
  and p.user_id is null;

update public.payments
set status = case
  when status is not null then status
  when lower(coalesce(payment_status, '')) in ('success', 'successful', 'completed', 'paid') then 'completed'
  when lower(coalesce(payment_status, '')) in ('failed', 'failure') then 'failed'
  when lower(coalesce(payment_status, '')) = 'refunded' then 'refunded'
  else 'pending'
end
where status is null;

alter table public.payments alter column status set default 'pending';

create unique index if not exists idx_payments_razorpay_payment_id
  on public.payments (razorpay_payment_id)
  where razorpay_payment_id is not null;

create index if not exists idx_payments_user
  on public.payments(user_id);

create index if not exists idx_payments_order
  on public.payments(order_id);
