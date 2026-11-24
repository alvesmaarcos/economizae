begin;

create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  chat_id bigint unique,
  linked_at timestamptz,
  code_hash text unique,
  code_expires_at timestamptz,
  check (
    (chat_id is null and linked_at is null and code_hash is not null and code_expires_at is not null)
    or (chat_id is not null and linked_at is not null and code_hash is null and code_expires_at is null)
  )
);

create table if not exists public.telegram_drafts (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.telegram_links(id) on delete cascade,
  message_id bigint not null,
  prompt_message_id bigint,
  status text not null check (status in ('clarify', 'ready', 'confirmed', 'cancelled', 'invalid')),
  input jsonb,
  transactions jsonb,
  summary text,
  notified_at timestamptz,
  count integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  unique (link_id, message_id),
  unique (link_id, prompt_message_id)
);

alter table public.telegram_links enable row level security;
alter table public.telegram_drafts enable row level security;
revoke all on public.telegram_links, public.telegram_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.telegram_links, public.telegram_drafts to service_role;

create or replace function public.issue_telegram_link(account uuid, hashed_code text)
returns boolean language plpgsql set search_path = '' as $$
begin
  insert into public.telegram_links (user_id, code_hash, code_expires_at)
  values (account, hashed_code, now() + interval '10 minutes')
  on conflict (user_id) do update
    set code_hash = excluded.code_hash, code_expires_at = excluded.code_expires_at
    where telegram_links.chat_id is null;
  return found;
end;
$$;

create or replace function public.redeem_telegram_link(hashed_code text, sender bigint)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.telegram_links
    set chat_id = sender, linked_at = now(), code_hash = null, code_expires_at = null
    where code_hash = hashed_code and code_expires_at > now() and chat_id is null;
  return found;
exception when unique_violation then
  return false;
end;
$$;

create or replace function public.resolve_telegram_draft(draft uuid, sender bigint, should_confirm boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  link public.telegram_links%rowtype;
  pending public.telegram_drafts%rowtype;
  draft_card uuid;
  inserted_count integer;
begin
  -- Serialize confirmation with revocation, then lock the draft for repeat callbacks.
  select * into link from public.telegram_links where chat_id = sender for update;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;

  select * into pending from public.telegram_drafts where id = draft and link_id = link.id for update;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  if pending.status in ('confirmed', 'cancelled', 'invalid') then
    return jsonb_build_object('status', pending.status, 'count', pending.count);
  end if;
  if pending.expires_at <= now() or pending.status <> 'ready' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if not should_confirm then
    update public.telegram_drafts set status = 'cancelled', transactions = null, summary = null where id = draft;
    return jsonb_build_object('status', 'cancelled');
  end if;

  draft_card := (pending.transactions -> 0 ->> 'card_id')::uuid;
  if draft_card is not null then
    perform 1 from public.cards where id = draft_card and user_id = link.user_id for key share;
    if not found then
      update public.telegram_drafts set status = 'invalid', transactions = null, summary = null where id = draft;
      return jsonb_build_object('status', 'invalid');
    end if;
  end if;

  insert into public.transactions (
    user_id, description, amount, type, status, purchase_date, due_date, paid_at,
    competence_month, category_id, payment_method, card_id, recurrence_type,
    recurrence_group_id, installment_current, installment_total, notes
  )
  select link.user_id, item.description, item.amount, 'expense', item.status, item.purchase_date,
    item.due_date, item.paid_at, item.competence_month, null, item.payment_method,
    draft_card, item.recurrence_type, item.recurrence_group_id, item.installment_current,
    item.installment_total, null
  from jsonb_populate_recordset(null::public.transactions, pending.transactions) as item;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then raise exception 'Empty Telegram draft'; end if;

  update public.telegram_drafts set status = 'confirmed', count = inserted_count,
    transactions = null, summary = null where id = draft;
  return jsonb_build_object('status', 'confirmed', 'count', inserted_count);
end;
$$;

revoke all on function public.issue_telegram_link(uuid, text), public.redeem_telegram_link(text, bigint),
  public.resolve_telegram_draft(uuid, bigint, boolean) from public, anon, authenticated;
grant execute on function public.issue_telegram_link(uuid, text), public.redeem_telegram_link(text, bigint),
  public.resolve_telegram_draft(uuid, bigint, boolean) to service_role;

commit;
