-- Apply to existing Economizae databases before publishing the login update.
begin;

grant select, insert, update, delete
  on table public.categories, public.cards, public.transactions
  to authenticated;

drop policy if exists transaction_references_owned on public.transactions;
create policy transaction_references_owned
  on public.transactions as restrictive for all to authenticated
  using (true)
  with check (
    (category_id is null or exists (
      select 1 from public.categories
      where categories.id = transactions.category_id
        and categories.user_id = (select auth.uid())
    ))
    and
    (card_id is null or exists (
      select 1 from public.cards
      where cards.id = transactions.card_id
        and cards.user_id = (select auth.uid())
    ))
  );

commit;
