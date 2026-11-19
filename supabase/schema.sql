-- =============================================================================
-- ECONOMIZAÊ — Schema PostgreSQL + Row Level Security (Supabase)
-- Execute este script no SQL Editor do seu projeto no Supabase.
-- =============================================================================

-- Extensão para geração de UUIDs
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Tabela de Categorias (categories)
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text not null default '#3B82F6',
  icon text not null default 'pi-tag',
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_user_id on public.categories(user_id);

alter table public.categories enable row level security;

create policy "Usuários podem visualizar suas próprias categorias"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "Usuários podem criar suas próprias categorias"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar suas próprias categorias"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuários podem excluir suas próprias categorias"
  on public.categories for delete
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. Tabela de Cartões de Crédito / Débito (cards)
-- -----------------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8B5CF6',
  modality text not null check (modality in ('both', 'credit', 'debit')) default 'both',
  closing_day integer null check (closing_day is null or (closing_day >= 1 and closing_day <= 31)),
  due_day integer null check (due_day is null or (due_day >= 1 and due_day <= 31)),
  credit_limit numeric(12, 2) null check (credit_limit is null or credit_limit >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_cards_user_id on public.cards(user_id);

alter table public.cards enable row level security;

create policy "Usuários podem visualizar seus próprios cartões"
  on public.cards for select
  using (auth.uid() = user_id);

create policy "Usuários podem criar seus próprios cartões"
  on public.cards for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar seus próprios cartões"
  on public.cards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuários podem excluir seus próprios cartões"
  on public.cards for delete
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Tabela de Lançamentos / Contas a Pagar (transactions)
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  status text not null check (status in ('pending', 'paid')) default 'pending',
  purchase_date date null,
  due_date date not null,
  paid_at date null,
  competence_month text not null, -- formato 'YYYY-MM'
  category_id uuid null references public.categories(id) on delete set null,
  payment_method text null check (
    payment_method in ('pix', 'boleto', 'credit_card', 'debit_card', 'cash', 'transfer')
  ),
  card_id uuid null references public.cards(id) on delete set null,
  recurrence_type text not null check (
    recurrence_type in ('single', 'fixed', 'installment')
  ) default 'single',
  recurrence_group_id uuid null,
  installment_current integer null,
  installment_total integer null,
  notes text null,
  created_at timestamptz not null default now()
);

-- Caso a tabela transactions já exista de uma versão anterior, garante as novas colunas:
alter table public.transactions add column if not exists purchase_date date null;
alter table public.transactions add column if not exists card_id uuid null references public.cards(id) on delete set null;

create index if not exists idx_transactions_user_month
  on public.transactions(user_id, competence_month);

create index if not exists idx_transactions_user_status_due
  on public.transactions(user_id, status, due_date);

create index if not exists idx_transactions_card_id
  on public.transactions(card_id);

create index if not exists idx_transactions_recurrence_group
  on public.transactions(recurrence_group_id);

alter table public.transactions enable row level security;

create policy "Usuários podem visualizar seus próprios lançamentos"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Usuários podem inserir seus próprios lançamentos"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar seus próprios lançamentos"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuários podem excluir seus próprios lançamentos"
  on public.transactions for delete
  using (auth.uid() = user_id);
