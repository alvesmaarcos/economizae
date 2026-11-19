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
  getCompetenceMonth,
  getCompetenceMonthFromDate,
  toISODateString
} from '@/lib/finance-calculations';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_KEYS = {
  TRANSACTIONS: 'economizae_transactions_v1',
  CATEGORIES: 'economizae_categories_v1',
  CARDS: 'economizae_cards_v1',
  SEEDED: 'economizae_seeded_v1'
};

function createInitialSampleTransactions(now: Date = new Date()): Transaction[] {
  const ym = getCompetenceMonth(now);
  const todayDay = now.getDate();
  const padDay = (d: number) =>
    String(Math.max(1, Math.min(28, d))).padStart(2, '0');

  const overdueDay = padDay(Math.max(1, todayDay - 3));
  const todayDayStr = String(todayDay).padStart(2, '0');

  return [
    {
      id: 'sample-inc-1',
      description: 'Salário Mensal',
      amount: 6800.0,
      type: 'income',
      status: 'paid',
      purchase_date: `${ym}-05`,
      due_date: `${ym}-05`,
      paid_at: `${ym}-05`,
      competence_month: ym,
      category_id: 'cat-income-salary',
      payment_method: 'transfer',
      card_id: null,
      recurrence_type: 'fixed',
      recurrence_group_id: 'grp-salary',
      installment_current: null,
      installment_total: null,
      notes: 'Depósito em conta principal'
    },
    {
      id: 'sample-inc-2',
      description: 'Consultoria / Projeto Freelance',
      amount: 1450.0,
      type: 'income',
      status: 'pending',
      purchase_date: `${ym}-22`,
      due_date: `${ym}-22`,
      paid_at: null,
      competence_month: ym,
      category_id: 'cat-income-freelance',
      payment_method: 'pix',
      card_id: null,
      recurrence_type: 'single',
      recurrence_group_id: null,
      installment_current: null,
      installment_total: null,
      notes: 'A receber na entrega final'
    },
    {
      id: 'sample-exp-1',
      description: 'Aluguel + Condomínio',
      amount: 2150.0,
      type: 'expense',
      status: 'paid',
      purchase_date: `${ym}-09`,
      due_date: `${ym}-10`,
      paid_at: `${ym}-09`,
      competence_month: ym,
      category_id: 'cat-expense-housing',
      payment_method: 'boleto',
      card_id: null,
      recurrence_type: 'fixed',
      recurrence_group_id: 'grp-rent',
      installment_current: null,
      installment_total: null,
      notes: 'Pago com antecedência'
    },
    {
      id: 'sample-exp-2',
      description: 'Compras do Mês no Supermercado',
      amount: 920.5,
      type: 'expense',
      status: 'paid',
      purchase_date: `${ym}-07`,
      due_date: `${ym}-07`,
      paid_at: `${ym}-07`,
      competence_month: ym,
      category_id: 'cat-expense-food',
      payment_method: 'debit_card',
      card_id: 'card-nubank',
      recurrence_type: 'single',
      recurrence_group_id: null,
      installment_current: null,
      installment_total: null,
      notes: 'Pago no débito Nubank'
    },
    {
      id: 'sample-bill-1',
      description: 'Conta de Energia Elétrica',
      amount: 265.9,
      type: 'expense',
      status: 'pending',
      purchase_date: `${ym}-01`,
      due_date: `${ym}-${overdueDay}`,
      paid_at: null,
      competence_month: ym,
      category_id: 'cat-expense-utilities',
      payment_method: 'boleto',
      card_id: null,
      recurrence_type: 'fixed',
      recurrence_group_id: 'grp-energy',
      installment_current: null,
      installment_total: null,
      notes: 'Boleto disponível no app da concessionária'
    },
    {
      id: 'sample-bill-2',
      description: 'Internet Fibra 600 Mega',
      amount: 129.9,
      type: 'expense',
      status: 'pending',
      purchase_date: `${ym}-01`,
      due_date: `${ym}-${todayDayStr}`,
      paid_at: null,
      competence_month: ym,
      category_id: 'cat-expense-utilities',
      payment_method: 'pix',
      card_id: null,
      recurrence_type: 'fixed',
      recurrence_group_id: 'grp-internet',
      installment_current: null,
      installment_total: null,
      notes: 'Pagar via PIX copia e cola'
    },
    {
      id: 'sample-bill-3',
      description: 'Notebook Trabalho',
      amount: 420.0,
      type: 'expense',
      status: 'pending',
      purchase_date: `${ym}-01`,
      due_date: `${ym}-10`,
      paid_at: null,
      competence_month: ym,
      category_id: 'cat-expense-credit',
      payment_method: 'credit_card',
      card_id: 'card-nubank',
      recurrence_type: 'installment',
      recurrence_group_id: 'grp-notebook',
      installment_current: 3,
      installment_total: 10,
      notes: 'Parcelamento sem juros no Nubank'
    },
    {
      id: 'sample-bill-4',
      description: 'Plano de Saúde / Academia',
      amount: 340.0,
      type: 'expense',
      status: 'pending',
      purchase_date: `${ym}-12`,
      due_date: `${ym}-25`,
      paid_at: null,
      competence_month: ym,
      category_id: 'cat-expense-health',
      payment_method: 'credit_card',
      card_id: 'card-itau',
      recurrence_type: 'fixed',
      recurrence_group_id: 'grp-health',
      installment_current: null,
      installment_total: null,
      notes: 'Recorrente no cartão Itaú Click'
    }
  ];
}

function getLocalCategories(): Category[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
  const raw = window.localStorage.getItem(STORAGE_KEYS.CATEGORIES);
  if (!raw) {
    window.localStorage.setItem(
      STORAGE_KEYS.CATEGORIES,
      JSON.stringify(DEFAULT_CATEGORIES)
    );
    return DEFAULT_CATEGORIES;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function saveLocalCategories(categories: Category[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEYS.CATEGORIES,
    JSON.stringify(categories)
  );
}

function getLocalCards(): PaymentCard[] {
  if (typeof window === 'undefined') return DEFAULT_CARDS;
  const raw = window.localStorage.getItem(STORAGE_KEYS.CARDS);
  if (!raw) {
    window.localStorage.setItem(
      STORAGE_KEYS.CARDS,
      JSON.stringify(DEFAULT_CARDS)
    );
    return DEFAULT_CARDS;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CARDS;
  } catch {
    return DEFAULT_CARDS;
  }
}

function saveLocalCards(cards: PaymentCard[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
}

function getLocalTransactions(): Transaction[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  const seeded = window.localStorage.getItem(STORAGE_KEYS.SEEDED);

  if (!raw && !seeded) {
    const sample = createInitialSampleTransactions(new Date());
    window.localStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(sample)
    );
    window.localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
    return sample;
  }

  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalTransactions(transactions: Transaction[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEYS.TRANSACTIONS,
    JSON.stringify(transactions)
  );
  window.localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
}

async function getCurrentSupabaseUserId(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export const financeRepository = {
  /**
   * Verifica se está operando conectado a uma sessão autenticada no Supabase
   */
  async getActiveStorageMode(): Promise<{
    mode: 'supabase' | 'local';
    userEmail: string | null;
    isCloudConfigured: boolean;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        mode: 'local',
        userEmail: null,
        isCloudConfigured: false
      };
    }

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (user) {
      return {
        mode: 'supabase',
        userEmail: user.email ?? 'Usuário autenticado',
        isCloudConfigured: true
      };
    }

    return {
      mode: 'local',
      userEmail: null,
      isCloudConfigured: true
    };
  },

  /**
   * Lista todas as categorias disponíveis
   */
  async listCategories(): Promise<Category[]> {
    const userId = await getCurrentSupabaseUserId();
    if (userId && supabase) {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as Category[];
      }

      if (!error && data && data.length === 0) {
        const seedRows = DEFAULT_CATEGORIES.map((c) => ({
          user_id: userId,
          name: c.name,
          type: c.type,
          color: c.color,
          icon: c.icon
        }));
        const { data: inserted } = await supabase
          .from('categories')
          .insert(seedRows)
          .select('*');
        if (inserted && inserted.length > 0) {
          return inserted as Category[];
        }
      }
    }

    return getLocalCategories();
  },

  /**
   * Cria uma nova categoria personalizada
   */
  async createCategory(
    category: Omit<Category, 'id' | 'created_at' | 'user_id'>
  ): Promise<Category> {
    const userId = await getCurrentSupabaseUserId();
    if (userId && supabase) {
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
    }

    const current = getLocalCategories();
    const created: Category = {
      id: `cat-${crypto.randomUUID()}`,
      name: category.name.trim(),
      type: category.type,
      color: category.color,
      icon: category.icon
    };
    const updated = [...current, created];
    saveLocalCategories(updated);
    return created;
  },

  /**
   * Exclui uma categoria
   */
  async deleteCategory(categoryId: string): Promise<void> {
    const userId = await getCurrentSupabaseUserId();
    if (userId && supabase) {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);
      if (error) throw new Error(error.message);
      return;
    }

    const current = getLocalCategories().filter((c) => c.id !== categoryId);
    saveLocalCategories(current);
  },

  /**
   * Lista todos os cartões cadastrados (Crédito / Débito)
   */
  async listCards(): Promise<PaymentCard[]> {
    const userId = await getCurrentSupabaseUserId();
    if (userId && supabase) {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((row) => ({
          ...row,
          credit_limit:
            row.credit_limit !== null ? Number(row.credit_limit) : null
        })) as PaymentCard[];
      }

      if (!error && data && data.length === 0) {
        const seedRows = DEFAULT_CARDS.map((card) => ({
          user_id: userId,
          name: card.name,
          color: card.color,
          modality: card.modality,
          closing_day: card.closing_day,
          due_day: card.due_day,
          credit_limit: card.credit_limit
        }));
        const { data: inserted } = await supabase
          .from('cards')
          .insert(seedRows)
          .select('*');
        if (inserted && inserted.length > 0) {
          return inserted.map((row) => ({
            ...row,
            credit_limit:
              row.credit_limit !== null ? Number(row.credit_limit) : null
          })) as PaymentCard[];
        }
      }
    }

    return getLocalCards();
  },

  /**
   * Cadastra um novo cartão
   */
  async createCard(
    card: Omit<PaymentCard, 'id' | 'created_at' | 'user_id'>
  ): Promise<PaymentCard> {
    const userId = await getCurrentSupabaseUserId();
    if (userId && supabase) {
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
    }

    const current = getLocalCards();
    const created: PaymentCard = {
      id: `card-${crypto.randomUUID()}`,
      name: card.name.trim(),
      color: card.color,
      modality: card.modality,
      closing_day: card.closing_day,
      due_day: card.due_day,
      credit_limit: card.credit_limit
    };
    const updated = [...current, created];
    saveLocalCards(updated);
    return created;
  },

  /**
   * Atualiza um cartão existente
   */
  async updateCard(
    cardId: string,
    updates: Partial<Omit<PaymentCard, 'id' | 'created_at' | 'user_id'>>
  ): Promise<PaymentCard> {
    const userId = await getCurrentSupabaseUserId();
    if (userId && supabase) {
      const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', cardId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return {
        ...(data as PaymentCard),
        credit_limit:
          data.credit_limit !== null ? Number(data.credit_limit) : null
      };
    }

    const current = getLocalCards();
    const idx = current.findIndex((c) => c.id === cardId);
    if (idx === -1) throw new Error('Cartão não encontrado');
    const updatedCard: PaymentCard = {
      ...current[idx],
      ...updates
    };
    current[idx] = updatedCard;
    saveLocalCards(current);
    return updatedCard;
  },

  /**
   * Exclui um cartão
   */
  async deleteCard(cardId: string): Promise<void> {
    const userId = await getCurrentSupabaseUserId();
    if (userId && supabase) {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId);
      if (error) throw new Error(error.message);
      return;
    }

    const current = getLocalCards().filter((c) => c.id !== cardId);
    saveLocalCards(current);
  },

  /**
   * Lista transações de um mês de competência ('YYYY-MM')
   */
  async listTransactionsByMonth(
    competenceMonth: string
  ): Promise<Transaction[]> {
    const userId = await getCurrentSupabaseUserId();
    if (userId && supabase) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('competence_month', competenceMonth)
        .order('due_date', { ascending: true });

      if (error) throw new Error(error.message);
      return (data || []).map((row) => ({
        ...row,
        amount: Number(row.amount)
      })) as Transaction[];
    }

    const all = getLocalTransactions();
    return all
      .filter((tx) => tx.competence_month === competenceMonth)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
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
    const userId = await getCurrentSupabaseUserId();

    if (userId && supabase) {
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
    }

    const current = getLocalTransactions();
    const updated = [...current, ...(generated as Transaction[])];
    saveLocalTransactions(updated);
    return generated as Transaction[];
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
    if (updates.status === 'paid' && !updates.paid_at) {
      normalizedUpdates.paid_at = toISODateString(new Date());
    } else if (updates.status === 'pending') {
      normalizedUpdates.paid_at = null;
    }

    const userId = await getCurrentSupabaseUserId();
    if (userId && supabase) {
      const { data, error } = await supabase
        .from('transactions')
        .update(normalizedUpdates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return {
        ...(data as Transaction),
        amount: Number(data.amount)
      };
    }

    const current = getLocalTransactions();
    const index = current.findIndex((tx) => tx.id === id);
    if (index === -1) throw new Error('Lançamento não encontrado');

    const updatedItem: Transaction = {
      ...current[index],
      ...normalizedUpdates
    };
    current[index] = updatedItem;
    saveLocalTransactions(current);
    return updatedItem;
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
    const userId = await getCurrentSupabaseUserId();

    if (userId && supabase) {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'paid',
          paid_at: todayISO
        })
        .eq('competence_month', competenceMonth)
        .eq('card_id', cardId)
        .eq('payment_method', 'credit_card')
        .eq('status', 'pending')
        .select('id');

      if (error) throw new Error(error.message);
      return data ? data.length : 0;
    }

    const current = getLocalTransactions();
    let paidCount = 0;
    const updated = current.map((tx) => {
      if (
        tx.competence_month === competenceMonth &&
        tx.card_id === cardId &&
        tx.payment_method === 'credit_card' &&
        tx.status === 'pending'
      ) {
        paidCount += 1;
        return {
          ...tx,
          status: 'paid' as const,
          paid_at: todayISO
        };
      }
      return tx;
    });

    if (paidCount > 0) {
      saveLocalTransactions(updated);
    }
    return paidCount;
  },

  /**
   * Exclui um lançamento único ou toda a série de parcelas/recorrência
   */
  async deleteTransaction(
    transaction: Transaction,
    scope: 'single' | 'all_group' = 'single'
  ): Promise<void> {
    const userId = await getCurrentSupabaseUserId();

    if (userId && supabase) {
      if (scope === 'all_group' && transaction.recurrence_group_id) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('recurrence_group_id', transaction.recurrence_group_id);
        if (error) throw new Error(error.message);
        return;
      }

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id);
      if (error) throw new Error(error.message);
      return;
    }

    const current = getLocalTransactions();
    const filtered = current.filter((tx) => {
      if (scope === 'all_group' && transaction.recurrence_group_id) {
        return tx.recurrence_group_id !== transaction.recurrence_group_id;
      }
      return tx.id !== transaction.id;
    });
    saveLocalTransactions(filtered);
  }
};
