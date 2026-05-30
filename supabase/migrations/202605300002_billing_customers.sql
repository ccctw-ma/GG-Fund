create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  status text not null,
  price_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.billing_customers enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_customers'
      and policyname = 'billing customers are readable by owner'
  ) then
    create policy "billing customers are readable by owner"
      on public.billing_customers for select
      using (auth.uid() = user_id);
  end if;
end
$$;
