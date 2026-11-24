import {
  buildSafeISODate,
  calculateCreditCardFirstDueDate,
  formatBRL,
  formatDateBR,
  generateRecurringTransactions
} from '@/lib/finance-calculations';
import { PAYMENT_METHOD_LABELS, type PaymentCard, type PaymentMethod, type Transaction } from '@/types/finance';

const paymentMethods = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
const fields = {
  intent: ['expense', 'unsupported', null],
  description: 'string',
  amount_cents: 'integer',
  amount_kind: ['total', 'per_installment', null],
  status: ['paid', 'pending', null],
  method: [...paymentMethods, null],
  card_name: 'string',
  purchase_date: 'string',
  due_date: 'string',
  paid_date: 'string',
  current: 'integer',
  total: 'integer',
  remaining: 'integer',
  remaining_includes_current: 'boolean',
  question: 'string'
} as const;

type FieldValue<T> = T extends readonly (infer Value)[] ? Value
  : T extends 'string' ? string | null
  : T extends 'integer' ? number | null
  : boolean | null;

export type ExpenseExtraction = { [Key in keyof typeof fields]: FieldValue<(typeof fields)[Key]> };
type DraftTransaction = Omit<Transaction, 'id' | 'created_at' | 'user_id'>;

export const expenseSchema = {
  type: 'object',
  properties: Object.fromEntries(Object.entries(fields).map(([key, rule]) => [key,
    typeof rule === 'string' ? { type: [rule, 'null'] } : { type: ['string', 'null'], enum: rule }
  ])),
  required: Object.keys(fields),
  additionalProperties: false
};

export function readExpenseExtraction(value: unknown): ExpenseExtraction {
  if (!value || typeof value !== 'object') throw new Error('Invalid Gemini output');
  const input = value as Record<string, unknown>;
  for (const [key, rule] of Object.entries(fields)) {
    const field = input[key];
    if (field === null) continue;
    const valid = typeof rule !== 'string' ? (rule as readonly unknown[]).includes(field)
      : rule === 'integer' ? Number.isSafeInteger(field) : typeof field === rule;
    if (!valid) throw new Error('Invalid Gemini output field');
  }
  return input as ExpenseExtraction;
}

export function saoPauloDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function validDate(date: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  return buildSafeISODate(year, month - 1, day) === date;
}

function normalizeName(name: string): string {
  return name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function installments(input: ExpenseExtraction): { current: number; total: number } | string {
  let { current, total } = input;
  const remaining = input.remaining;
  if (remaining !== null) {
    if (remaining < 0 || remaining > 60) return 'Quantas parcelas ainda faltam?';
    const includesCurrent = input.remaining_includes_current;
    if (current !== null && total !== null) {
      const afterCurrent = total - current;
      if ((includesCurrent === true && remaining !== afterCurrent + 1)
        || (includesCurrent === false && remaining !== afterCurrent)
        || (includesCurrent === null && remaining !== afterCurrent && remaining !== afterCurrent + 1)) {
        return 'A parcela atual e o total não batem com a quantidade que falta. Qual é a parcela atual e o total?';
      }
    } else {
      if (current === null && total === null) return 'Qual é a parcela atual e o total da compra?';
      if (includesCurrent === null) return 'A quantidade de parcelas que falta inclui a parcela atual?';
      const afterCurrent = remaining - (includesCurrent ? 1 : 0);
      if (afterCurrent < 0) return 'Quantas parcelas ficam depois da parcela atual?';
      if (current !== null) total = current + afterCurrent;
      else if (total !== null) current = total - afterCurrent;
    }
  }

  if (current !== null && total === null) return 'Qual é o total de parcelas da compra?';
  if (total === null) return { current: 1, total: 1 };
  current ??= 1;
  if (current < 1 || total < 1 || total > 60 || current > total) {
    return 'Informe a parcela atual e o total, entre 1 e 60. Exemplo: parcela 3 de 10.';
  }
  return { current, total };
}

export type ExpenseDraft =
  | { status: 'clarify' | 'invalid'; summary: string }
  | { status: 'ready'; summary: string; transactions: DraftTransaction[] };

export function prepareExpense(input: ExpenseExtraction, cards: PaymentCard[], today: string): ExpenseDraft {
  const clarify = (summary: string): ExpenseDraft => ({ status: 'clarify', summary });
  if (input.intent === 'unsupported') {
    return { status: 'invalid', summary: 'Envie uma despesa por mensagem. Exemplo: -25 corte de cabelo.' };
  }
  if (input.question?.trim()) return clarify(input.question.trim().slice(0, 300));
  const description = input.description?.replace(/\s+/g, ' ').trim();
  if (!description || description.length > 160) return clarify('Qual é a descrição da despesa? Use até 160 caracteres.');
  if (!input.amount_cents || input.amount_cents < 1 || input.amount_cents > 999_999_999_999) {
    return clarify('Qual é o valor da despesa em reais?');
  }
  const schedule = installments(input);
  if (typeof schedule === 'string') return clarify(schedule);
  const { current, total } = schedule;
  const status = input.status;
  let amountCents = input.amount_cents;
  if (total > 1) {
    if (!input.amount_kind) return clarify('Esse valor é por parcela ou é o total da compra?');
    if (input.amount_kind === 'total') {
      if (amountCents % total !== 0) return clarify('O total não divide em parcelas iguais em centavos. Qual é o valor de cada parcela?');
      amountCents /= total;
    }
  }
  if (!status) return clarify(total > 1 ? 'A parcela atual já foi paga ou está pendente?' : 'A despesa já foi paga ou é uma conta a pagar?');
  const { purchase_date: purchaseDate, due_date: explicitDueDate, paid_date: paidDate } = input;
  if ([purchaseDate, explicitDueDate, paidDate].some(date => date !== null && !validDate(date))) {
    return clarify('Informe a data completa no formato DD/MM/AAAA.');
  }
  if (paidDate && (paidDate > today || status !== 'paid')) {
    return clarify('O lançamento está pago? Se estiver, informe uma data de pagamento até hoje.');
  }

  const cardName = normalizeName(input.card_name ?? '');
  const exactCards = cards.filter(card => normalizeName(card.name) === cardName);
  const matches = exactCards.length || cardName.length < 3 ? exactCards
    : cards.filter(card => normalizeName(card.name).includes(cardName));
  if (cardName && matches.length !== 1) {
    const names = cards.map(card => card.name.replace(/\s+/g, ' ').trim()).join(', ').slice(0, 400);
    const choices = names ? ` Cartões cadastrados: ${names}.` : ' Cadastre um cartão no Economizaê para usá-lo.';
    return clarify(`Qual cartão foi usado?${choices}`);
  }
  const card = cardName ? matches[0] : undefined;
  let method: PaymentMethod | null = input.method;
  if (card && !method) method = card.modality === 'debit' ? 'debit_card' : 'credit_card';
  if ((method === 'credit_card' || method === 'debit_card') && !card) return clarify('Qual cartão cadastrado foi usado?');
  if (card && (method === 'credit_card' ? card.modality === 'debit'
    : method === 'debit_card' ? card.modality === 'credit' : true)) {
    return clarify('Qual foi a forma de pagamento e, se foi no cartão, foi no crédito ou débito?');
  }
  if (total > 1 && method === 'debit_card') return clarify('Confirme se o parcelamento foi feito no crédito ou por outra forma de pagamento.');

  let calculatedDueDate = method === 'debit_card' ? purchaseDate : null;
  if (method === 'credit_card' && card?.closing_day && card.due_day && purchaseDate) {
    const firstDueDate = calculateCreditCardFirstDueDate(purchaseDate, card.closing_day, card.due_day);
    const [year, month] = firstDueDate.split('-').map(Number);
    calculatedDueDate = buildSafeISODate(year, month + current - 2, card.due_day);
  }
  if (explicitDueDate && calculatedDueDate && explicitDueDate !== calculatedDueDate) {
    return clarify(`Pelas datas da compra e do cartão, o vencimento seria ${formatDateBR(calculatedDueDate)}. Qual data precisa ser corrigida?`);
  }
  let dueDate = explicitDueDate ?? calculatedDueDate;
  if (!dueDate && status === 'paid' && total === 1 && method !== 'credit_card') {
    dueDate = paidDate ?? purchaseDate ?? today;
  }
  if (!dueDate) return clarify(total > 1 ? 'Qual é a data de vencimento da parcela atual?' : 'Qual é a data de vencimento da despesa?');
  if (purchaseDate && dueDate < purchaseDate) return clarify('O vencimento ficou antes da compra. Quais são as datas corretas?');
  const effectivePaidDate = status === 'paid' ? paidDate ?? (dueDate <= today ? dueDate : today) : null;
  if (purchaseDate && effectivePaidDate && effectivePaidDate < purchaseDate) {
    return clarify('O pagamento ficou antes da compra. Qual foi a data do pagamento?');
  }

  const [year, month] = dueDate.split('-').map(Number);
  const cardDay = method === 'credit_card' && card?.due_day
    && buildSafeISODate(year, month - 1, card.due_day) === dueDate ? card.due_day : undefined;
  const generated = generateRecurringTransactions({
    description, amount: amountCents / 100, type: 'expense', status,
    due_date: dueDate, paid_at: effectivePaidDate, category_id: null,
    payment_method: method, card_id: card?.id,
    recurrence_type: total > 1 ? 'installment' : 'single', installment_total: total, paid_installments: 0
  }, undefined, null, today, { start: current, currentDueDate: dueDate, dueDay: cardDay });
  const transactions: DraftTransaction[] = generated.map(({ id: _id, ...item }, index) => ({
    ...item,
    purchase_date: purchaseDate,
    status: index === 0 ? status : 'pending',
    paid_at: index === 0 ? effectivePaidDate : null
  }));

  const statusText = status === 'paid' ? `Paga em ${formatDateBR(effectivePaidDate)}` : 'Pendente';
  const amountText = formatBRL(amountCents / 100);
  const pending = transactions.length - (status === 'paid' ? 1 : 0);
  const summary = [
    `Confirme a despesa: ${description}`,
    total > 1 ? `${amountText} por parcela · parcelas ${current} a ${total} de ${total}` : amountText,
    ...(method ? [`Pagamento: ${PAYMENT_METHOD_LABELS[method].label}${card ? ` · ${card.name}` : ''}`] : []),
    ...(purchaseDate ? [`Compra: ${formatDateBR(purchaseDate)}`] : []),
    `Vencimento ${total > 1 ? 'da parcela atual' : 'da despesa'}: ${formatDateBR(dueDate)}`,
    statusText,
    ...(total > 1 ? [`Parcelas pendentes nesta série: ${pending}`] : [])
  ].join('\n');
  return { status: 'ready', summary, transactions };
}
