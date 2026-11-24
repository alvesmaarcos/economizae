import { describe, expect, it } from 'vitest';
import { prepareExpense, readExpenseExtraction, saoPauloDate, type ExpenseExtraction } from '@/lib/telegram-expense';
import type { PaymentCard } from '@/types/finance';

const today = '2026-11-24';
const card: PaymentCard = {
  id: 'c709f7ba-02c0-4d9a-88dc-328908332d92', name: 'Nubank', color: '#000000', modality: 'credit',
  closing_day: 3, due_day: 10, credit_limit: null
};

function expense(fields: Partial<ExpenseExtraction> = {}): ExpenseExtraction {
  return {
    intent: 'expense', description: 'corte de cabelo', amount_cents: 2500, amount_kind: null, status: 'paid',
    method: null, card_name: null, purchase_date: null, due_date: null, paid_date: null,
    current: null, total: null, remaining: null, remaining_includes_current: null, question: null, ...fields
  };
}

describe('Telegram expense drafts', () => {
  it('uses today in São Paulo for a simple paid expense without dates', () => {
    expect(saoPauloDate(new Date('2026-11-25T01:00:00Z'))).toBe(today);
    expect(prepareExpense(expense(), [], today)).toMatchObject({ status: 'ready', transactions: [{
      description: 'corte de cabelo', amount: 25, status: 'paid', paid_at: today, due_date: today
    }] });
  });

  it('asks for the due date of a pending bill and rejects impossible dates', () => {
    const pending = expense({ status: 'pending', method: 'boleto' });
    expect(prepareExpense(pending, [], today)).toMatchObject({ status: 'clarify', summary: expect.stringContaining('vencimento') });
    expect(prepareExpense({ ...pending, due_date: '2026-02-30' }, [], today)).toMatchObject({ status: 'clarify' });
    expect(prepareExpense({ ...pending, due_date: '2026-12-09' }, [], today)).toMatchObject({
      status: 'ready', transactions: [{ status: 'pending', paid_at: null, due_date: '2026-12-09', payment_method: 'boleto' }]
    });
  });

  it('keeps the original installment numbering and only records the current and future installments', () => {
    const result = prepareExpense(expense({
      description: 'geladeira', amount_cents: 120_000, amount_kind: 'total', current: 3, total: 10,
      status: 'pending', card_name: 'nubank', due_date: '2026-12-10'
    }), [card], today);
    if (result.status !== 'ready') throw new Error(result.summary);
    expect(result.transactions.map(row => row.installment_current)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.transactions[0]).toMatchObject({
      installment_total: 10, due_date: '2026-12-10', status: 'pending', card_id: card.id, amount: 120
    });
    expect(result.transactions[7]).toMatchObject({ due_date: '2027-07-10', status: 'pending' });
    expect(new Set(result.transactions.map(row => row.recurrence_group_id)).size).toBe(1);
  });

  it('marks only the current installment paid and computes the total from explicit remaining installments', () => {
    const result = prepareExpense(expense({
      total: null, current: 4, remaining: 2, remaining_includes_current: false,
      amount_kind: 'per_installment', due_date: '2026-11-23', paid_date: today
    }), [], today);
    expect(result).toMatchObject({ status: 'ready', transactions: [
      { installment_current: 4, installment_total: 6, paid_at: today, status: 'paid' },
      { installment_current: 5, due_date: '2026-12-23', paid_at: null, status: 'pending' },
      { installment_current: 6, due_date: '2027-01-23', paid_at: null, status: 'pending' }
    ] });
  });

  it('calculates card dates from the purchase and retains month-end invoice dates after February', () => {
    const purchase = expense({ purchase_date: '2026-01-15', card_name: 'Nubank', status: 'pending',
      current: 2, total: 4, amount_kind: 'per_installment' });
    const cards = [{ ...card, closing_day: 22, due_day: 31 }];
    expect(prepareExpense(purchase, cards, today)).toMatchObject({ status: 'ready', transactions: [
      { installment_current: 2, due_date: '2026-02-28' },
      { installment_current: 3, due_date: '2026-03-31' },
      { installment_current: 4, due_date: '2026-04-30' }
    ] });
    expect(prepareExpense({ ...purchase, due_date: '2026-03-01' }, cards, today))
      .toMatchObject({ status: 'clarify', summary: expect.stringContaining('28/02/2026') });
  });

  it('asks about ambiguous cards, installment amounts and remaining counts', () => {
    expect(prepareExpense(expense({ card_name: 'Nubank' }), [
      { ...card, name: 'Nubank Virtual' }, { ...card, name: 'Nubank Principal' }
    ], today)).toMatchObject({ status: 'clarify', summary: expect.stringContaining('Qual cartão') });
    expect(prepareExpense(expense({ current: 3, total: 10 }), [], today))
      .toMatchObject({ status: 'clarify', summary: expect.stringContaining('total da compra') });
    expect(prepareExpense(expense({ current: 3, remaining: 7 }), [], today))
      .toMatchObject({ status: 'clarify', summary: expect.stringContaining('inclui a parcela atual') });
  });

  it('rejects malformed structured responses and unsupported requests', () => {
    expect(() => readExpenseExtraction({ ...expense(), amount_cents: '2500' })).toThrow();
    expect(prepareExpense(expense({ intent: 'unsupported' }), [], today)).toMatchObject({ status: 'invalid' });
  });
});
