-- Apply to an existing Economizae database before deploying real cash balances.
begin;

create table if not exists public.balance_adjustments (
  user_id uuid not null references auth.users(id) on delete cascade,
  balance_date date not null,
  amount numeric(14, 2) not null,
  primary key (user_id, balance_date)
);

alter table public.balance_adjustments enable row level security;

drop policy if exists manage_own_balance_adjustments on public.balance_adjustments;
create policy manage_own_balance_adjustments
  on public.balance_adjustments for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and balance_date <= (now() at time zone 'America/Sao_Paulo')::date
  );

revoke all on table public.balance_adjustments from public, anon, authenticated;
grant select, insert, update on table public.balance_adjustments to authenticated;

create index if not exists idx_transactions_paid_cash_date
  on public.transactions (user_id, (coalesce(paid_at, due_date)))
  where status = 'paid';

create or replace function public.get_real_balance(as_of_date date)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  with latest_adjustment as (
    select balance_date, amount
      from public.balance_adjustments
     where user_id = (select auth.uid())
       and balance_date <= as_of_date
     order by balance_date desc
     limit 1
  )
  select coalesce((select amount from latest_adjustment), 0)
       + coalesce(sum(case when type = 'income' then amount else -amount end), 0)
    from public.transactions
   where user_id = (select auth.uid())
     and status = 'paid'
     and coalesce(paid_at, due_date) <= as_of_date
     and coalesce(paid_at, due_date) >
         coalesce((select balance_date from latest_adjustment), '-infinity'::date);
$$;

revoke all on function public.get_real_balance(date) from public, anon;
grant execute on function public.get_real_balance(date) to authenticated;

commit;
