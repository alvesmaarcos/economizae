export type TransactionType = 'income' | 'expense';

/**
 * 'pending':
 *   - Para 'expense': Conta a Pagar (Saída Pendente)
 *   - Para 'income': Entrada a Receber
 * 'paid':
 *   - Para 'expense': Saída Paga
 *   - Para 'income': Entrada Recebida
 */
export type TransactionStatus = 'pending' | 'paid';

export type PaymentMethod =
  | 'pix'
  | 'boleto'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'transfer';

export type RecurrenceType = 'single' | 'fixed' | 'installment';

export type CardModality = 'both' | 'credit' | 'debit';

export interface PaymentCard {
  id: string;
  user_id?: string;
  name: string;
  color: string;
  modality: CardModality;
  /** Dia de fechamento da fatura (1 a 31) — aplicável quando modality for 'both' ou 'credit' */
  closing_day: number | null;
  /** Dia de vencimento da fatura (1 a 31) — aplicável quando modality for 'both' ou 'credit' */
  due_day: number | null;
  /** Limite de crédito opcional para acompanhar o uso na fatura do mês */
  credit_limit: number | null;
  created_at?: string;
}

export interface Category {
  id: string;
  user_id?: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string; // Classe do PrimeIcons ex: 'pi-home', 'pi-wallet'
  created_at?: string;
}

export interface Transaction {
  id: string;
  user_id?: string;
  description: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  /** Data original em que a compra foi realizada ('YYYY-MM-DD') */
  purchase_date?: string | null;
  /** Data de vencimento ou efetivação no fluxo de caixa ('YYYY-MM-DD') */
  due_date: string;
  paid_at: string | null; // 'YYYY-MM-DD' | null
  competence_month: string; // 'YYYY-MM'
  category_id: string | null;
  payment_method: PaymentMethod | null;
  /** ID do cartão utilizado quando payment_method for 'credit_card' ou 'debit_card' */
  card_id?: string | null;
  recurrence_type: RecurrenceType;
  recurrence_group_id: string | null;
  installment_current: number | null;
  installment_total: number | null;
  notes: string | null;
  created_at?: string;
}

export interface CreateTransactionInput {
  description: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  /** Data da compra (especialmente relevante para cartão de crédito/débito) */
  purchase_date?: string | null;
  /** Data de vencimento (calculada automaticamente para cartão de crédito) */
  due_date: string; // 'YYYY-MM-DD'
  paid_at?: string | null;
  category_id: string | null;
  payment_method: PaymentMethod | null;
  card_id?: string | null;
  recurrence_type: RecurrenceType;
  installment_total?: number | null;
  paid_installments?: number;
  fixed_months?: number; // padrão 12 meses quando 'fixed'
  notes?: string | null;
}

export type DueAlertState =
  | 'paid'
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'upcoming';

export interface DueStatusInfo {
  state: DueAlertState;
  label: string;
  severity: 'success' | 'danger' | 'warning' | 'info';
  daysDiff: number;
  icon: string;
}

export interface CardInvoiceSummary {
  card: PaymentCard;
  competenceMonth: string;
  dueDateISO: string;
  pendingAmount: number;
  paidAmount: number;
  totalAmount: number;
  pendingCount: number;
  totalCount: number;
  dueStatus: DueStatusInfo;
  limitUsagePercent: number | null;
}

export interface MonthlySummary {
  /** Soma de todas as entradas do mês (recebidas + a receber) */
  incomeTotal: number;
  /** Entradas já efetivadas (status = 'paid') */
  incomeReceived: number;
  /** Entradas pendentes (status = 'pending') */
  incomePending: number;
  /** Saídas já pagas no mês (type = 'expense' && status = 'paid') */
  expensePaid: number;
  /** Contas a pagar / saídas pendentes no mês (type = 'expense' && status = 'pending') */
  billsToPayTotal: number;
  /** Soma de todas as saídas do mês (pagas + pendentes) */
  expenseTotal: number;
  /** Quantidade de contas a pagar em aberto no mês */
  billsToPayCount: number;
  /** Quantidade de saídas já pagas no mês */
  expensePaidCount: number;
  /** Contas a pagar vencidas (due_date < hoje) */
  overdueBillsCount: number;
  overdueBillsAmount: number;
  /** Contas a pagar que vencem exatamente hoje */
  dueTodayCount: number;
  dueTodayAmount: number;
  /** Contas a pagar que vencem nos próximos 3 dias */
  dueSoonCount: number;
  dueSoonAmount: number;
  /** Saldo real acumulado até a data de referência */
  currentBalance: number;
  /** Saldo real acrescido das entradas pendentes e descontadas as saídas pendentes */
  projectedBalance: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  color: string;
  icon: string;
  paidAmount: number;
  pendingAmount: number;
  totalAmount: number;
  percentage: number;
}

export const PAYMENT_METHOD_LABELS: Record<
  PaymentMethod,
  { label: string; icon: string }
> = {
  pix: { label: 'PIX', icon: 'pi-bolt' },
  boleto: { label: 'Boleto Bancário', icon: 'pi-qrcode' },
  credit_card: { label: 'Cartão de Crédito', icon: 'pi-credit-card' },
  debit_card: { label: 'Cartão de Débito', icon: 'pi-id-card' },
  cash: { label: 'Dinheiro', icon: 'pi-money-bill' },
  transfer: { label: 'Transferência / TED', icon: 'pi-arrows-h' }
};

export const CARD_MODALITY_LABELS: Record<CardModality, string> = {
  both: 'Crédito e Débito',
  credit: 'Apenas Crédito',
  debit: 'Apenas Débito'
};

export const PRIME_ICON_OPTIONS: { label: string; value: string }[] = [
  { label: 'Carteira', value: 'pi-wallet' },
  { label: 'Dinheiro', value: 'pi-money-bill' },
  { label: 'Cifrão', value: 'pi-dollar' },
  { label: 'Casa / Moradia', value: 'pi-home' },
  { label: 'Mercado / Compras', value: 'pi-shopping-cart' },
  { label: 'Sacola', value: 'pi-shopping-bag' },
  { label: 'Transporte / Carro', value: 'pi-car' },
  { label: 'Saúde / Coração', value: 'pi-heart' },
  { label: 'Educação / Livro', value: 'pi-book' },
  { label: 'Energia / Contas', value: 'pi-bolt' },
  { label: 'Wi-Fi / Internet', value: 'pi-wifi' },
  { label: 'Cartão de Crédito', value: 'pi-credit-card' },
  { label: 'Lazer / Estrela', value: 'pi-star' },
  { label: 'Viagem / Globo', value: 'pi-globe' },
  { label: 'Trabalho / Maleta', value: 'pi-briefcase' },
  { label: 'Gráfico / Investimento', value: 'pi-chart-line' },
  { label: 'Presente', value: 'pi-gift' },
  { label: 'Celular', value: 'pi-mobile' },
  { label: 'Ferramentas / Serviços', value: 'pi-wrench' },
  { label: 'Etiqueta / Outros', value: 'pi-tag' }
];

export const DEFAULT_CARDS: PaymentCard[] = [
  {
    id: 'card-nubank',
    name: 'Nubank',
    color: '#8B5CF6',
    modality: 'both',
    closing_day: 3,
    due_day: 10,
    credit_limit: 5000
  },
  {
    id: 'card-itau',
    name: 'Itaú Click',
    color: '#F97316',
    modality: 'both',
    closing_day: 18,
    due_day: 25,
    credit_limit: 6000
  },
  {
    id: 'card-inter',
    name: 'Banco Inter',
    color: '#EA580C',
    modality: 'both',
    closing_day: 25,
    due_day: 5,
    credit_limit: 4000
  }
];

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-income-salary',
    name: 'Salário',
    type: 'income',
    color: '#10B981',
    icon: 'pi-wallet'
  },
  {
    id: 'cat-income-freelance',
    name: 'Renda Extra / Freelance',
    type: 'income',
    color: '#06B6D4',
    icon: 'pi-briefcase'
  },
  {
    id: 'cat-income-invest',
    name: 'Rendimentos',
    type: 'income',
    color: '#3B82F6',
    icon: 'pi-chart-line'
  },
  {
    id: 'cat-expense-housing',
    name: 'Moradia & Contas Fixas',
    type: 'expense',
    color: '#6366F1',
    icon: 'pi-home'
  },
  {
    id: 'cat-expense-food',
    name: 'Alimentação & Mercado',
    type: 'expense',
    color: '#F59E0B',
    icon: 'pi-shopping-cart'
  },
  {
    id: 'cat-expense-utilities',
    name: 'Luz, Água & Internet',
    type: 'expense',
    color: '#EAB308',
    icon: 'pi-bolt'
  },
  {
    id: 'cat-expense-transport',
    name: 'Transporte & Combustível',
    type: 'expense',
    color: '#EC4899',
    icon: 'pi-car'
  },
  {
    id: 'cat-expense-health',
    name: 'Saúde & Farmácia',
    type: 'expense',
    color: '#EF4444',
    icon: 'pi-heart'
  },
  {
    id: 'cat-expense-education',
    name: 'Educação & Cursos',
    type: 'expense',
    color: '#8B5CF6',
    icon: 'pi-book'
  },
  {
    id: 'cat-expense-leisure',
    name: 'Lazer & Assinaturas',
    type: 'expense',
    color: '#14B8A6',
    icon: 'pi-star'
  },
  {
    id: 'cat-expense-credit',
    name: 'Cartão / Parcelamentos',
    type: 'expense',
    color: '#F97316',
    icon: 'pi-credit-card'
  }
];
