import { describe, expect, it } from 'vitest';
import {
  addMonthsToISODate,
  calculateCardInvoicesForMonth,
  calculateCategoryBreakdown,
  calculateCreditCardFirstDueDate,
  calculateMonthlySummary,
  generateRecurringTransactions,
  getBalanceReferenceDate,
  getDueStatus
} from '../finance-calculations';
import {
  CreateTransactionInput,
  DEFAULT_CARDS,
  DEFAULT_CATEGORIES,
  PaymentCard,
  Transaction
} from '@/types/finance';

describe('finance-calculations', () => {
  it('calcula corretamente Entradas, Saídas Pagas, Contas a Pagar e Saldos do mês', () => {
    const today = '2026-11-11';
    const sampleTransactions: Transaction[] = [
      {
        id: '1',
        description: 'Salário Mensal',
        amount: 6500,
        type: 'income',
        status: 'paid',
        due_date: '2026-11-05',
        paid_at: '2026-11-05',
        competence_month: '2026-11',
        category_id: 'cat-income-salary',
        payment_method: 'transfer',
        recurrence_type: 'fixed',
        recurrence_group_id: 'g1',
        installment_current: null,
        installment_total: null,
        notes: null
      },
      {
        id: '2',
        description: 'Freelance Projeto Web',
        amount: 1500,
        type: 'income',
        status: 'pending',
        due_date: '2026-11-25',
        paid_at: null,
        competence_month: '2026-11',
        category_id: 'cat-income-freelance',
        payment_method: 'pix',
        recurrence_type: 'single',
        recurrence_group_id: null,
        installment_current: null,
        installment_total: null,
        notes: null
      },
      {
        id: '3',
        description: 'Aluguel',
        amount: 2200,
        type: 'expense',
        status: 'paid',
        due_date: '2026-11-10',
        paid_at: '2026-11-10',
        competence_month: '2026-11',
        category_id: 'cat-expense-housing',
        payment_method: 'boleto',
        recurrence_type: 'fixed',
        recurrence_group_id: 'g2',
        installment_current: null,
        installment_total: null,
        notes: null
      },
      {
        id: '4',
        description: 'Conta de Energia (Atrasada)',
        amount: 280,
        type: 'expense',
        status: 'pending',
        due_date: '2026-11-08',
        paid_at: null,
        competence_month: '2026-11',
        category_id: 'cat-expense-utilities',
        payment_method: 'boleto',
        recurrence_type: 'single',
        recurrence_group_id: null,
        installment_current: null,
        installment_total: null,
        notes: null
      },
      {
        id: '5',
        description: 'Internet Fibra (Vence Hoje)',
        amount: 120,
        type: 'expense',
        status: 'pending',
        due_date: '2026-11-11',
        paid_at: null,
        competence_month: '2026-11',
        category_id: 'cat-expense-utilities',
        payment_method: 'pix',
        recurrence_type: 'fixed',
        recurrence_group_id: 'g3',
        installment_current: null,
        installment_total: null,
        notes: null
      }
    ];

    const summary = calculateMonthlySummary(sampleTransactions, today);

    expect(summary.incomeReceived).toBe(6500);
    expect(summary.incomePending).toBe(1500);
    expect(summary.incomeTotal).toBe(8000);

    expect(summary.expensePaid).toBe(2200);
    expect(summary.billsToPayTotal).toBe(400);
    expect(summary.expenseTotal).toBe(2600);

    expect(summary.overdueBillsCount).toBe(1);
    expect(summary.overdueBillsAmount).toBe(280);
    expect(summary.dueTodayCount).toBe(1);
    expect(summary.dueTodayAmount).toBe(120);

    expect(summary.currentBalance).toBe(4300);
    expect(summary.projectedBalance).toBe(5400);

    const accumulated = calculateMonthlySummary(sampleTransactions, today, -500);
    expect(accumulated.currentBalance).toBe(-500);
    expect(accumulated.projectedBalance).toBe(600);
    expect(accumulated.incomeTotal).toBe(summary.incomeTotal);
    expect(accumulated.expenseTotal).toBe(summary.expenseTotal);
  });

  it('calcula a data de vencimento da fatura do cartão de crédito a partir da data da compra, fechamento e vencimento', () => {
    // Caso 1: Cartão Nubank (Fecha dia 03, Vence dia 10)
    // Compra dia 02/11 (antes do fechamento dia 03) -> vence em 10/11/2026
    expect(calculateCreditCardFirstDueDate('2026-11-02', 3, 10)).toBe(
      '2026-11-10'
    );

    // Compra dia 03/11 ou 16/11 (no dia ou após o fechamento dia 03) -> vence em 10/12/2026
    expect(calculateCreditCardFirstDueDate('2026-11-03', 3, 10)).toBe(
      '2026-12-10'
    );
    expect(calculateCreditCardFirstDueDate('2026-11-16', 3, 10)).toBe(
      '2026-12-10'
    );

    // Caso 2: Cartão Banco Inter (Fecha dia 25, Vence dia 05 do mês seguinte)
    // Compra dia 16/11 (antes do fechamento dia 25) -> fecha em 25/11 e vence em 05/12/2026
    expect(calculateCreditCardFirstDueDate('2026-11-16', 25, 5)).toBe(
      '2026-12-05'
    );

    // Compra dia 26/11 (após o fechamento dia 25/11) -> fecha em 25/12 e vence em 05/01/2027
    expect(calculateCreditCardFirstDueDate('2026-11-26', 25, 5)).toBe(
      '2027-01-05'
    );
  });

  it('gera compras no cartão de crédito (à vista e parceladas) alocando automaticamente nas faturas corretas', () => {
    const nubank: PaymentCard = {
      id: 'card-nubank',
      name: 'Nubank',
      color: '#8B5CF6',
      modality: 'both',
      closing_day: 3,
      due_day: 10,
      credit_limit: 5000
    };

    let counter = 0;
    const installments = generateRecurringTransactions(
      {
        description: 'TV 4K',
        amount: 350,
        type: 'expense',
        status: 'pending',
        purchase_date: '2026-11-16',
        due_date: '2026-11-16',
        category_id: 'cat-expense-credit',
        payment_method: 'credit_card',
        card_id: 'card-nubank',
        recurrence_type: 'installment',
        installment_total: 3
      },
      () => `id-${++counter}`,
      nubank
    );

    expect(installments).toHaveLength(3);
    // Compra em 16/11 (após fechamento dia 03) -> 1ª parcela vence em 10/12/2026!
    expect(installments[0].purchase_date).toBe('2026-11-16');
    expect(installments[0].due_date).toBe('2026-12-10');
    expect(installments[0].competence_month).toBe('2026-12');
    expect(installments[0].card_id).toBe('card-nubank');
    expect(installments[0].installment_current).toBe(1);

    // 2ª parcela vence em 10/01/2027
    expect(installments[1].due_date).toBe('2027-01-10');
    expect(installments[1].competence_month).toBe('2027-01');
    expect(installments[1].installment_current).toBe(2);

    // 3ª parcela vence em 10/02/2027
    expect(installments[2].due_date).toBe('2027-02-10');
    expect(installments[2].competence_month).toBe('2027-02');
    expect(installments[2].installment_current).toBe(3);
  });

  it('consolida as faturas de cartão do mês com calculateCardInvoicesForMonth', () => {
    const txs: Transaction[] = [
      {
        id: 't1',
        description: 'Supermercado no Crédito',
        amount: 400,
        type: 'expense',
        status: 'pending',
        purchase_date: '2026-10-20',
        due_date: '2026-11-10',
        paid_at: null,
        competence_month: '2026-11',
        category_id: 'cat-expense-food',
        payment_method: 'credit_card',
        card_id: 'card-nubank',
        recurrence_type: 'single',
        recurrence_group_id: null,
        installment_current: null,
        installment_total: null,
        notes: null
      },
      {
        id: 't2',
        description: 'Uber',
        amount: 100,
        type: 'expense',
        status: 'pending',
        purchase_date: '2026-10-25',
        due_date: '2026-11-10',
        paid_at: null,
        competence_month: '2026-11',
        category_id: 'cat-expense-transport',
        payment_method: 'credit_card',
        card_id: 'card-nubank',
        recurrence_type: 'single',
        recurrence_group_id: null,
        installment_current: null,
        installment_total: null,
        notes: null
      }
    ];

    const invoices = calculateCardInvoicesForMonth(
      txs,
      DEFAULT_CARDS,
      '2026-11',
      '2026-11-08'
    );

    expect(invoices).toHaveLength(1);
    expect(invoices[0].card.name).toBe('Nubank');
    expect(invoices[0].pendingAmount).toBe(500);
    expect(invoices[0].pendingCount).toBe(2);
    expect(invoices[0].dueDateISO).toBe('2026-11-10');
    expect(invoices[0].limitUsagePercent).toBe(10); // 500 / 5000 = 10%
  });

  it('classifica corretamente o status de vencimento e agrupa categorias', () => {
    const today = '2026-11-11';
    expect(
      getDueStatus(
        {
          status: 'pending',
          due_date: '2026-11-09',
          type: 'expense',
          paid_at: null
        },
        today
      ).state
    ).toBe('overdue');

    const txs: Transaction[] = [
      {
        id: '1',
        description: 'Aluguel',
        amount: 1500,
        type: 'expense',
        status: 'paid',
        due_date: '2026-11-10',
        paid_at: '2026-11-10',
        competence_month: '2026-11',
        category_id: 'cat-expense-housing',
        payment_method: 'pix',
        recurrence_type: 'single',
        recurrence_group_id: null,
        installment_current: null,
        installment_total: null,
        notes: null
      }
    ];
    const breakdown = calculateCategoryBreakdown(
      txs,
      DEFAULT_CATEGORIES,
      'expense'
    );
    expect(breakdown[0].percentage).toBe(100);
    expect(addMonthsToISODate('2024-01-31', 1)).toBe('2024-02-29');
  });
});

describe('saldo acumulado', () => {
  it('usa o encerramento de meses passados, inclusive na virada do ano e em ano bissexto', () => {
    expect(getBalanceReferenceDate('2026-12', '2027-01-05')).toBe('2026-12-31');
    expect(getBalanceReferenceDate('2024-02', '2024-03-05')).toBe('2024-02-29');
  });

  it('usa hoje como limite no mês atual e em meses futuros', () => {
    expect(getBalanceReferenceDate('2027-01', '2027-01-05')).toBe('2027-01-05');
    expect(getBalanceReferenceDate('2027-02', '2027-01-05')).toBe('2027-01-05');
    expect(calculateMonthlySummary([], '2027-01-05', -20).projectedBalance).toBe(-20);
  });
});

describe('parcelas pagas antes do cadastro', () => {
  const purchase: CreateTransactionInput = {
    description: 'Compra parcelada',
    amount: 120,
    type: 'expense',
    status: 'pending',
    purchase_date: '2025-12-16',
    due_date: '2025-12-16',
    category_id: null,
    payment_method: 'credit_card',
    recurrence_type: 'installment',
    installment_total: 12
  };
  const card: PaymentCard = {
    id: 'test-card',
    name: 'Cartão de teste',
    color: '#000000',
    modality: 'credit',
    closing_day: 15,
    due_day: 10,
    credit_limit: null
  };

  it.each([0, 5, 12])('gera as 12 parcelas com %i pagas', (paidCount) => {
    const installments = generateRecurringTransactions(
      { ...purchase, paid_installments: paidCount },
      () => 'test-id',
      card,
      '2027-02-28'
    );

    expect(installments).toHaveLength(12);
    expect(installments.filter((item) => item.status === 'paid')).toHaveLength(paidCount);
    expect(installments.map((item) => item.installment_current)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1)
    );
    expect(installments[0].due_date).toBe('2026-02-10');
    expect(installments[4].paid_at).toBe(paidCount >= 5 ? '2026-06-10' : null);
    expect(installments[5].paid_at).toBe(paidCount >= 6 ? '2026-07-10' : null);
  });

  it.each([-1, 1.5, 13])('rejeita a contagem inválida %i', (paidCount) => {
    expect(() => generateRecurringTransactions(
      { ...purchase, paid_installments: paidCount },
      () => 'test-id',
      card,
      '2027-02-28'
    )).toThrow('quantidade válida');
  });

  it('rejeita a marcação como paga quando o vencimento está no futuro', () => {
    expect(() => generateRecurringTransactions(
      { ...purchase, paid_installments: 5 },
      () => 'test-id',
      card,
      '2026-06-09'
    )).toThrow('vencimento até hoje');
  });
});
