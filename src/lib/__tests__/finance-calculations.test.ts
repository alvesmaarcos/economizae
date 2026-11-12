import { describe, expect, it } from 'vitest';
import {
  addMonthsToISODate,
  calculateCategoryBreakdown,
  calculateMonthlySummary,
  generateRecurringTransactions,
  getDueStatus
} from '../finance-calculations';
import { DEFAULT_CATEGORIES, Transaction } from '@/types/finance';

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
    expect(summary.billsToPayTotal).toBe(400); // 280 + 120
    expect(summary.expenseTotal).toBe(2600);

    expect(summary.overdueBillsCount).toBe(1);
    expect(summary.overdueBillsAmount).toBe(280);
    expect(summary.dueTodayCount).toBe(1);
    expect(summary.dueTodayAmount).toBe(120);

    // Saldo Atual em Caixa = 6500 (recebido) - 2200 (pago) = 4300
    expect(summary.currentBalance).toBe(4300);

    // Saldo Previsto no Mês = 8000 (total entradas) - 2600 (total saídas) = 5400
    expect(summary.projectedBalance).toBe(5400);
  });

  it('gera compras parceladas corretamente atravessando virada de ano e fim de mês', () => {
    let counter = 0;
    const items = generateRecurringTransactions(
      {
        description: 'Notebook',
        amount: 450,
        type: 'expense',
        status: 'paid',
        due_date: '2026-11-30',
        category_id: 'cat-expense-credit',
        payment_method: 'credit_card',
        recurrence_type: 'installment',
        installment_total: 4
      },
      () => `id-${++counter}`
    );

    expect(items).toHaveLength(4);
    expect(items[0].competence_month).toBe('2026-11');
    expect(items[0].status).toBe('paid');
    expect(items[0].installment_current).toBe(1);
    expect(items[0].installment_total).toBe(4);

    expect(items[1].competence_month).toBe('2026-12');
    expect(items[1].due_date).toBe('2026-12-30');
    expect(items[1].status).toBe('pending');
    expect(items[1].installment_current).toBe(2);

    expect(items[2].competence_month).toBe('2027-01');
    expect(items[2].due_date).toBe('2027-01-30');

    // Fevereiro de 2027 tem 28 dias
    expect(items[3].competence_month).toBe('2027-02');
    expect(items[3].due_date).toBe('2027-02-28');
    expect(items[3].installment_current).toBe(4);
  });

  it('classifica corretamente o status de vencimento (overdue, due_today, due_soon, upcoming, paid)', () => {
    const today = '2026-11-11';

    expect(
      getDueStatus(
        { status: 'pending', due_date: '2026-11-09', type: 'expense', paid_at: null },
        today
      ).state
    ).toBe('overdue');

    expect(
      getDueStatus(
        { status: 'pending', due_date: '2026-11-11', type: 'expense', paid_at: null },
        today
      ).state
    ).toBe('due_today');

    expect(
      getDueStatus(
        { status: 'pending', due_date: '2026-11-13', type: 'expense', paid_at: null },
        today
      ).state
    ).toBe('due_soon');

    expect(
      getDueStatus(
        { status: 'pending', due_date: '2026-11-25', type: 'expense', paid_at: null },
        today
      ).state
    ).toBe('upcoming');

    expect(
      getDueStatus(
        { status: 'paid', due_date: '2026-11-05', type: 'expense', paid_at: '2026-11-05' },
        today
      ).state
    ).toBe('paid');
  });

  it('agrupa despesas por categoria com percentuais corretos', () => {
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
      },
      {
        id: '2',
        description: 'Supermercado',
        amount: 500,
        type: 'expense',
        status: 'pending',
        due_date: '2026-11-20',
        paid_at: null,
        competence_month: '2026-11',
        category_id: 'cat-expense-food',
        payment_method: 'credit_card',
        recurrence_type: 'single',
        recurrence_group_id: null,
        installment_current: null,
        installment_total: null,
        notes: null
      }
    ];

    const breakdown = calculateCategoryBreakdown(txs, DEFAULT_CATEGORIES, 'expense');
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].categoryId).toBe('cat-expense-housing');
    expect(breakdown[0].percentage).toBe(75);
    expect(breakdown[1].categoryId).toBe('cat-expense-food');
    expect(breakdown[1].percentage).toBe(25);
  });

  it('addMonthsToISODate respeita anos bissextos e fins de mês', () => {
    expect(addMonthsToISODate('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsToISODate('2026-01-31', 1)).toBe('2026-02-28');
  });
});
