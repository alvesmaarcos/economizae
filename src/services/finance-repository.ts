import {
  Category,
  CreateTransactionInput,
  DEFAULT_CARDS,
  DEFAULT_CATEGORIES,
  PaymentCard,
  Transaction,
  TransactionStatus
} from '@/types/finance';
import {
  calculateCreditCardFirstDueDate,
  generateRecurringTransactions,
  getCompetenceMonthFromDate,
  toISODateString
} from '@/lib/finance-calculations';
import type { SupabaseClient } from '@supabase/supabase-js';

// Stable IDs make default initialization safe across tabs and concurrent loads.
async function defaultRecordId(userId: string, templateId: string): Promise<string> {
  const input = new TextEncoder().encode(`${userId}:${templateId}`);
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createFinanceRepository(supabase: SupabaseClient, userId: string) {
  return {
    async getRealBalance(asOfDate: string): Promise<number> {
      const { data, error } = await supabase.rpc('get_real_balance', {
        as_of_date: asOfDate
      });
      if (error) throw new Error(error.message);
      return Number(data);
    },

    async saveBalanceAdjustment(date: string, amount: number): Promise<void> {
      const { error } = await supabase
        .from('balance_adjustments')
        .upsert(
          { user_id: userId, balance_date: date, amount },
          { onConflict: 'user_id,balance_date' }
        );
      if (error) throw new Error(error.message);
    },

    /**
     * Lista todas as categorias disponíveis
     */
    async listCategories(seedDefaults = true): Promise<Category[]> {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw new Error(error.message);
      if (data.length === 0 && seedDefaults) {
        const rows = await Promise.all(
          DEFAULT_CATEGORIES.map(async (category) => ({
            id: await defaultRecordId(userId, category.id),
            user_id: userId,
            name: category.name,
            type: category.type,
            color: category.color,
            icon: category.icon
          }))
        );
        const { error: seedError } = await supabase
          .from('categories')
          .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
        if (seedError) throw new Error(seedError.message);
        return this.listCategories(false);
      }

      return data as Category[];
    },

    /**
     * Cria uma nova categoria personalizada
     */
    async createCategory(
      category: Omit<Category, 'id' | 'created_at' | 'user_id'>
    ): Promise<Category> {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: category.name.trim(),
          type: category.type,
          color: category.color,
          icon: category.icon
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data as Category;
    },

    /**
     * Exclui uma categoria
     */
    async deleteCategory(categoryId: string): Promise<void> {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('user_id', userId)
        .eq('id', categoryId);
      if (error) throw new Error(error.message);
      return;
    },

    /**
     * Lista todos os cartões cadastrados (Crédito / Débito)
     */
    async listCards(seedDefaults = true): Promise<PaymentCard[]> {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw new Error(error.message);
      if (data.length === 0 && seedDefaults) {
        const rows = await Promise.all(
          DEFAULT_CARDS.map(async (card) => ({
            id: await defaultRecordId(userId, card.id),
            user_id: userId,
            name: card.name,
            color: card.color,
            modality: card.modality,
            closing_day: card.closing_day,
            due_day: card.due_day,
            credit_limit: card.credit_limit
          }))
        );
        const { error: seedError } = await supabase
          .from('cards')
          .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
        if (seedError) throw new Error(seedError.message);
        return this.listCards(false);
      }

      return data.map((row) => ({
        ...row,
        credit_limit: row.credit_limit !== null ? Number(row.credit_limit) : null
      })) as PaymentCard[];
    },

    /**
     * Cadastra um novo cartão
     */
    async createCard(
      card: Omit<PaymentCard, 'id' | 'created_at' | 'user_id'>
    ): Promise<PaymentCard> {
      const { data, error } = await supabase
        .from('cards')
        .insert({
          user_id: userId,
          name: card.name.trim(),
          color: card.color,
          modality: card.modality,
          closing_day: card.closing_day,
          due_day: card.due_day,
          credit_limit: card.credit_limit
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return {
        ...(data as PaymentCard),
        credit_limit:
          data.credit_limit !== null ? Number(data.credit_limit) : null
      };
    },

    /**
     * Atualiza um cartão existente
     */
    async updateCard(
      cardId: string,
      updates: Partial<Omit<PaymentCard, 'id' | 'created_at' | 'user_id'>>
    ): Promise<PaymentCard> {
      const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('user_id', userId)
        .eq('id', cardId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return {
        ...(data as PaymentCard),
        credit_limit:
          data.credit_limit !== null ? Number(data.credit_limit) : null
      };
    },

    /**
     * Exclui um cartão
     */
    async deleteCard(cardId: string): Promise<void> {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('user_id', userId)
        .eq('id', cardId);
      if (error) throw new Error(error.message);
      return;
    },

    /**
     * Lista transações de um mês de competência ('YYYY-MM')
     */
    async listTransactionsByMonth(
      competenceMonth: string
    ): Promise<Transaction[]> {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('competence_month', competenceMonth)
        .order('due_date', { ascending: true });

      if (error) throw new Error(error.message);
      return (data || []).map((row) => ({
        ...row,
        amount: Number(row.amount)
      })) as Transaction[];
    },

    /**
     * Cria lançamento(s) — único, fixo mensal ou parcelado.
     * Calcula automaticamente o vencimento da fatura se for em Cartão de Crédito.
     */
    async createTransactions(
      input: CreateTransactionInput,
      cards?: PaymentCard[]
    ): Promise<Transaction[]> {
      const availableCards = cards || (await this.listCards());
      const selectedCard = input.card_id
        ? availableCards.find((c) => c.id === input.card_id) || null
        : null;

      const generated = generateRecurringTransactions(
        input,
        () => crypto.randomUUID(),
        selectedCard
      );
      const payload = generated.map(({ id: _unusedId, ...rest }) => ({
        ...rest,
        user_id: userId
      }));
      const { data, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select('*');

      if (error) throw new Error(error.message);
      return (data || []).map((row) => ({
        ...row,
        amount: Number(row.amount)
      })) as Transaction[];
    },

    /**
     * Atualiza os dados de um lançamento existente
     */
    async updateTransaction(
      id: string,
      updates: Partial<
        Pick<
          Transaction,
          | 'description'
          | 'amount'
          | 'type'
          | 'status'
          | 'purchase_date'
          | 'due_date'
          | 'paid_at'
          | 'category_id'
          | 'payment_method'
          | 'card_id'
          | 'notes'
        >
      >,
      cards?: PaymentCard[]
    ): Promise<Transaction> {
      const normalizedUpdates: Partial<Transaction> = { ...updates };

      if (
        !updates.due_date &&
        updates.payment_method === 'credit_card' &&
        updates.card_id &&
        updates.purchase_date
      ) {
        const availableCards = cards || (await this.listCards());
        const card = availableCards.find((c) => c.id === updates.card_id);
        if (card && card.closing_day && card.due_day) {
          normalizedUpdates.due_date = calculateCreditCardFirstDueDate(
            updates.purchase_date,
            card.closing_day,
            card.due_day
          );
        }
      } else if (
        !updates.due_date &&
        updates.payment_method === 'debit_card' &&
        updates.purchase_date
      ) {
        normalizedUpdates.due_date = updates.purchase_date;
      }

      if (normalizedUpdates.due_date) {
        normalizedUpdates.competence_month = getCompetenceMonthFromDate(
          normalizedUpdates.due_date
        );
      }
      if (updates.status === 'paid' && updates.paid_at === undefined) {
        normalizedUpdates.paid_at = toISODateString(new Date());
      } else if (updates.status === 'pending') {
        normalizedUpdates.paid_at = null;
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(normalizedUpdates)
        .eq('user_id', userId)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return {
        ...(data as Transaction),
        amount: Number(data.amount)
      };
    },

    /**
     * Alterna rapidamente o status entre 'pending' (Conta a Pagar / A Receber) e 'paid' (Pago / Recebido)
     */
    async toggleTransactionStatus(
      transaction: Transaction
    ): Promise<Transaction> {
      const nextStatus: TransactionStatus =
        transaction.status === 'paid' ? 'pending' : 'paid';
      const paidAt =
        nextStatus === 'paid' ? toISODateString(new Date()) : null;

      return this.updateTransaction(transaction.id, {
        status: nextStatus,
        paid_at: paidAt
      });
    },

    /**
     * Dá baixa em todas as compras pendentes de uma fatura de Cartão de Crédito no mês selecionado
     */
    async payCardInvoice(
      cardId: string,
      competenceMonth: string
    ): Promise<number> {
      const todayISO = toISODateString(new Date());
      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'paid',
          paid_at: todayISO
        })
        .eq('user_id', userId)
        .eq('competence_month', competenceMonth)
        .eq('card_id', cardId)
        .eq('payment_method', 'credit_card')
        .eq('status', 'pending')
        .select('id');

      if (error) throw new Error(error.message);
      return data ? data.length : 0;
    },

    /**
     * Exclui um lançamento único ou toda a série de parcelas/recorrência
     */
    async deleteTransaction(
      transaction: Transaction,
      scope: 'single' | 'all_group' = 'single'
    ): Promise<void> {
      if (scope === 'all_group' && transaction.recurrence_group_id) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('user_id', userId)
          .eq('recurrence_group_id', transaction.recurrence_group_id);
        if (error) throw new Error(error.message);
        return;
      }

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', userId)
        .eq('id', transaction.id);
      if (error) throw new Error(error.message);
      return;
    }
  };
}
