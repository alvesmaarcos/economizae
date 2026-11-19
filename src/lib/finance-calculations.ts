import {
  CardInvoiceSummary,
  Category,
  CategoryBreakdownItem,
  CreateTransactionInput,
  DueStatusInfo,
  MonthlySummary,
  PaymentCard,
  Transaction
} from '@/types/finance';

/**
 * Formata um número para moeda brasileira (R$ 1.234,56)
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number.isFinite(value) ? value : 0);
}

/**
 * Formata uma string 'YYYY-MM-DD' para 'DD/MM/YYYY' sem distorção de fuso horário
 */
export function formatDateBR(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Formata 'YYYY-MM' para nome legível do mês/ano (ex: 'Dezembro/2026')
 */
export function formatCompetenceMonthBR(competenceMonth: string): string {
  const [y, m] = competenceMonth.split('-').map(Number);
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];
  const monthName = months[(m || 1) - 1] || competenceMonth;
  return `${monthName}/${y}`;
}

/**
 * Converte um objeto Date local em string 'YYYY-MM-DD'
 */
export function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converte uma string 'YYYY-MM-DD' para objeto Date ao meio-dia local (evita problemas de fuso)
 */
export function parseISODateLocal(isoDate: string): Date {
  const [y, m, d] = isoDate.split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

/**
 * Extrai o mês de competência 'YYYY-MM' a partir de uma data 'YYYY-MM-DD'
 */
export function getCompetenceMonthFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/**
 * Retorna 'YYYY-MM' para um objeto Date
 */
export function getCompetenceMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Constrói uma string 'YYYY-MM-DD' limitando o dia ao máximo de dias daquele mês (ex: 31 em Fev -> 28/29)
 */
export function buildSafeISODate(
  year: number,
  monthIndexZeroBased: number,
  desiredDay: number
): string {
  const targetYear = year + Math.floor(monthIndexZeroBased / 12);
  const normalizedMonth = ((monthIndexZeroBased % 12) + 12) % 12;
  const maxDayInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(desiredDay, maxDayInMonth));

  const yStr = String(targetYear);
  const mStr = String(normalizedMonth + 1).padStart(2, '0');
  const dStr = String(safeDay).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Soma meses a uma data 'YYYY-MM-DD' preservando o dia com segurança para fins de mês (ex: 31/01 -> 28/02)
 */
export function addMonthsToISODate(
  isoDate: string,
  monthsToAdd: number
): string {
  const [year, month, day] = isoDate.split('T')[0].split('-').map(Number);
  return buildSafeISODate(year, month - 1 + monthsToAdd, day);
}

/**
 * Calcula a data de vencimento da 1ª fatura ('YYYY-MM-DD') para uma compra no Cartão de Crédito,
 * a partir da Data da Compra, do Dia de Fechamento (closingDay) e do Dia de Vencimento (dueDay).
 *
 * Regras:
 * 1. Se dia_da_compra < closingDay: a compra entra na fatura que fecha no próprio mês da compra.
 * 2. Se dia_da_compra >= closingDay: a fatura daquele mês já fechou, então a compra entra na fatura
 *    que fecha no mês seguinte.
 * 3. Determinado o mês de fechamento da fatura:
 *    - Se dueDay > closingDay (ex.: fecha dia 03 e vence dia 10): o vencimento ocorre no mesmo mês do fechamento.
 *    - Se dueDay <= closingDay (ex.: fecha dia 25 e vence dia 05): o vencimento ocorre no mês seguinte ao fechamento.
 */
export function calculateCreditCardFirstDueDate(
  purchaseDateISO: string,
  closingDay: number,
  dueDay: number
): string {
  const [pYear, pMonth, pDay] = purchaseDateISO
    .split('T')[0]
    .split('-')
    .map(Number);

  const safeClosingDay = Math.max(1, Math.min(31, Number(closingDay) || 1));
  const safeDueDay = Math.max(1, Math.min(31, Number(dueDay) || 10));

  // Mês base (0-indexed) em que a fatura desta compra fecha
  let closingMonthIndex = pMonth - 1;
  if (pDay >= safeClosingDay) {
    closingMonthIndex += 1;
  }

  // Mês em que a fatura vence
  let dueMonthIndex = closingMonthIndex;
  if (safeDueDay <= safeClosingDay) {
    dueMonthIndex += 1;
  }

  return buildSafeISODate(pYear, dueMonthIndex, safeDueDay);
}

/**
 * Calcula a diferença em dias inteiros entre dueDate ('YYYY-MM-DD') e todayDate ('YYYY-MM-DD')
 * Retorna negativo se vencida (ex: -3 = vencida há 3 dias), 0 se vence hoje, positivo se vence no futuro.
 */
export function diffDaysISO(dueDateISO: string, todayISO: string): number {
  const [y1, m1, d1] = dueDateISO.split('T')[0].split('-').map(Number);
  const [y2, m2, d2] = todayISO.split('T')[0].split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24));
}

/**
 * Classifica o status de vencimento de um lançamento (especialmente Contas a Pagar)
 */
export function getDueStatus(
  transaction: Pick<Transaction, 'status' | 'due_date' | 'type' | 'paid_at'>,
  todayISO: string = toISODateString(new Date())
): DueStatusInfo {
  if (transaction.status === 'paid') {
    return {
      state: 'paid',
      label: transaction.type === 'income' ? 'Recebido' : 'Pago',
      severity: 'success',
      daysDiff: 0,
      icon: 'pi-check-circle'
    };
  }

  const diff = diffDaysISO(transaction.due_date, todayISO);

  if (diff < 0) {
    const absDays = Math.abs(diff);
    return {
      state: 'overdue',
      label:
        absDays === 1 ? 'Vencida ontem' : `Vencida há ${absDays} dias`,
      severity: 'danger',
      daysDiff: diff,
      icon: 'pi-exclamation-triangle'
    };
  }

  if (diff === 0) {
    return {
      state: 'due_today',
      label: 'Vence hoje!',
      severity: 'warning',
      daysDiff: 0,
      icon: 'pi-bell'
    };
  }

  if (diff <= 3) {
    return {
      state: 'due_soon',
      label: diff === 1 ? 'Vence amanhã' : `Vence em ${diff} dias`,
      severity: 'warning',
      daysDiff: diff,
      icon: 'pi-clock'
    };
  }

  return {
    state: 'upcoming',
    label: `Vence em ${formatDateBR(transaction.due_date)}`,
    severity: 'info',
    daysDiff: diff,
    icon: 'pi-calendar'
  };
}

/**
 * Calcula todos os indicadores financeiros do mês selecionado:
 * - Entradas no mês (Total, Recebidas e A Receber)
 * - Saídas Pagas
 * - Contas a Pagar (Saídas Pendentes + Vencidas + Vencendo Hoje/Em Breve)
 * - Saldo Atual em Caixa (Entradas Recebidas - Saídas Pagas)
 * - Saldo Previsto do Mês (Total Entradas - Total Saídas [Pagas + Contas a Pagar])
 */
export function calculateMonthlySummary(
  transactions: Transaction[],
  todayISO: string = toISODateString(new Date())
): MonthlySummary {
  let incomeReceived = 0;
  let incomePending = 0;
  let expensePaid = 0;
  let billsToPayTotal = 0;
  let billsToPayCount = 0;
  let expensePaidCount = 0;
  let overdueBillsCount = 0;
  let overdueBillsAmount = 0;
  let dueTodayCount = 0;
  let dueTodayAmount = 0;
  let dueSoonCount = 0;
  let dueSoonAmount = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;

    if (tx.type === 'income') {
      if (tx.status === 'paid') {
        incomeReceived += amount;
      } else {
        incomePending += amount;
      }
    } else if (tx.type === 'expense') {
      if (tx.status === 'paid') {
        expensePaid += amount;
        expensePaidCount += 1;
      } else {
        billsToPayTotal += amount;
        billsToPayCount += 1;

        const diff = diffDaysISO(tx.due_date, todayISO);
        if (diff < 0) {
          overdueBillsCount += 1;
          overdueBillsAmount += amount;
        } else if (diff === 0) {
          dueTodayCount += 1;
          dueTodayAmount += amount;
        } else if (diff <= 3) {
          dueSoonCount += 1;
          dueSoonAmount += amount;
        }
      }
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const incomeTotal = round2(incomeReceived + incomePending);
  const expenseTotal = round2(expensePaid + billsToPayTotal);
  const currentBalance = round2(incomeReceived - expensePaid);
  const projectedBalance = round2(incomeTotal - expenseTotal);

  return {
    incomeTotal,
    incomeReceived: round2(incomeReceived),
    incomePending: round2(incomePending),
    expensePaid: round2(expensePaid),
    billsToPayTotal: round2(billsToPayTotal),
    expenseTotal,
    billsToPayCount,
    expensePaidCount,
    overdueBillsCount,
    overdueBillsAmount: round2(overdueBillsAmount),
    dueTodayCount,
    dueTodayAmount: round2(dueTodayAmount),
    dueSoonCount,
    dueSoonAmount: round2(dueSoonAmount),
    currentBalance,
    projectedBalance
  };
}

/**
 * Gera os registros de transação a partir do formulário (Único, Fixo Mensal ou Parcelado 1..N).
 * Se payment_method === 'credit_card' e um cartão com closing_day/due_day for informado,
 * calcula automaticamente a data de vencimento da 1ª fatura a partir de purchase_date!
 */
export function generateRecurringTransactions(
  input: CreateTransactionInput,
  idGenerator: () => string = () => crypto.randomUUID(),
  selectedCard?: PaymentCard | null
): Omit<Transaction, 'created_at'>[] {
  const rawPurchaseDate = input.purchase_date || input.due_date;
  let baseDueDate = input.due_date;

  if (
    input.payment_method === 'credit_card' &&
    selectedCard &&
    selectedCard.closing_day &&
    selectedCard.due_day
  ) {
    baseDueDate = calculateCreditCardFirstDueDate(
      rawPurchaseDate,
      selectedCard.closing_day,
      selectedCard.due_day
    );
  } else if (input.payment_method === 'debit_card' && input.purchase_date) {
    baseDueDate = input.purchase_date;
  }

  const recurrenceType = input.recurrence_type || 'single';
  const cardId =
    input.payment_method === 'credit_card' ||
    input.payment_method === 'debit_card'
      ? input.card_id || selectedCard?.id || null
      : null;

  if (recurrenceType === 'single') {
    return [
      {
        id: idGenerator(),
        description: input.description.trim(),
        amount: Number(input.amount),
        type: input.type,
        status: input.status,
        purchase_date: rawPurchaseDate,
        due_date: baseDueDate,
        paid_at:
          input.status === 'paid' ? input.paid_at || baseDueDate : null,
        competence_month: getCompetenceMonthFromDate(baseDueDate),
        category_id: input.category_id,
        payment_method: input.payment_method,
        card_id: cardId,
        recurrence_type: 'single',
        recurrence_group_id: null,
        installment_current: null,
        installment_total: null,
        notes: input.notes?.trim() || null
      }
    ];
  }

  const groupId = idGenerator();

  if (recurrenceType === 'installment') {
    const totalInstallments = Math.max(
      2,
      Math.min(60, Number(input.installment_total) || 2)
    );
    const items: Omit<Transaction, 'created_at'>[] = [];

    for (let i = 0; i < totalInstallments; i++) {
      const targetDueDate = addMonthsToISODate(baseDueDate, i);
      const installmentStatus = i === 0 ? input.status : 'pending';

      items.push({
        id: idGenerator(),
        description: input.description.trim(),
        amount: Number(input.amount),
        type: input.type,
        status: installmentStatus,
        purchase_date: rawPurchaseDate,
        due_date: targetDueDate,
        paid_at:
          installmentStatus === 'paid'
            ? input.paid_at || targetDueDate
            : null,
        competence_month: getCompetenceMonthFromDate(targetDueDate),
        category_id: input.category_id,
        payment_method: input.payment_method,
        card_id: cardId,
        recurrence_type: 'installment',
        recurrence_group_id: groupId,
        installment_current: i + 1,
        installment_total: totalInstallments,
        notes: input.notes?.trim() || null
      });
    }

    return items;
  }

  // recurrenceType === 'fixed' (gera para os próximos N meses, padrão 12 meses)
  const fixedMonths = Math.max(
    2,
    Math.min(24, Number(input.fixed_months) || 12)
  );
  const fixedItems: Omit<Transaction, 'created_at'>[] = [];

  for (let i = 0; i < fixedMonths; i++) {
    const targetDueDate = addMonthsToISODate(baseDueDate, i);
    const monthStatus = i === 0 ? input.status : 'pending';

    fixedItems.push({
      id: idGenerator(),
      description: input.description.trim(),
      amount: Number(input.amount),
      type: input.type,
      status: monthStatus,
      purchase_date: addMonthsToISODate(rawPurchaseDate, i),
      due_date: targetDueDate,
      paid_at:
        monthStatus === 'paid' ? input.paid_at || targetDueDate : null,
      competence_month: getCompetenceMonthFromDate(targetDueDate),
      category_id: input.category_id,
      payment_method: input.payment_method,
      card_id: cardId,
      recurrence_type: 'fixed',
      recurrence_group_id: groupId,
      installment_current: null,
      installment_total: null,
      notes: input.notes?.trim() || null
    });
  }

  return fixedItems;
}

/**
 * Consolida as faturas de Cartão de Crédito de cada cartão no mês selecionado
 */
export function calculateCardInvoicesForMonth(
  transactions: Transaction[],
  cards: PaymentCard[],
  competenceMonth: string,
  todayISO: string = toISODateString(new Date())
): CardInvoiceSummary[] {
  const cardMap = new Map<string, PaymentCard>();
  for (const card of cards) {
    cardMap.set(card.id, card);
  }

  const grouped = new Map<
    string,
    {
      card: PaymentCard;
      pendingAmount: number;
      paidAmount: number;
      pendingCount: number;
      totalCount: number;
      dueDateISO: string;
    }
  >();

  const [yearNum, monthNum] = competenceMonth.split('-').map(Number);

  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.payment_method !== 'credit_card') continue;
    if (!tx.card_id) continue;

    const card = cardMap.get(tx.card_id);
    if (!card) continue;

    if (!grouped.has(card.id)) {
      const defaultDueDate = card.due_day
        ? buildSafeISODate(yearNum, (monthNum || 1) - 1, card.due_day)
        : tx.due_date;

      grouped.set(card.id, {
        card,
        pendingAmount: 0,
        paidAmount: 0,
        pendingCount: 0,
        totalCount: 0,
        dueDateISO: defaultDueDate
      });
    }

    const entry = grouped.get(card.id)!;
    const amount = Number(tx.amount) || 0;
    entry.totalCount += 1;

    if (tx.status === 'paid') {
      entry.paidAmount = Math.round((entry.paidAmount + amount) * 100) / 100;
    } else {
      entry.pendingAmount =
        Math.round((entry.pendingAmount + amount) * 100) / 100;
      entry.pendingCount += 1;
      entry.dueDateISO = tx.due_date;
    }
  }

  return Array.from(grouped.values())
    .map((item) => {
      const totalAmount =
        Math.round((item.pendingAmount + item.paidAmount) * 100) / 100;
      const invoiceStatus: 'paid' | 'pending' =
        item.pendingCount === 0 ? 'paid' : 'pending';
      const dueStatus = getDueStatus(
        {
          status: invoiceStatus,
          due_date: item.dueDateISO,
          type: 'expense',
          paid_at: invoiceStatus === 'paid' ? item.dueDateISO : null
        },
        todayISO
      );

      const limitUsagePercent =
        item.card.credit_limit && item.card.credit_limit > 0
          ? Math.min(
              100,
              Math.round((totalAmount / item.card.credit_limit) * 1000) / 10
            )
          : null;

      return {
        card: item.card,
        competenceMonth,
        dueDateISO: item.dueDateISO,
        pendingAmount: item.pendingAmount,
        paidAmount: item.paidAmount,
        totalAmount,
        pendingCount: item.pendingCount,
        totalCount: item.totalCount,
        dueStatus,
        limitUsagePercent
      };
    })
    .sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO));
}

/**
 * Agrupa as saídas (pagas + contas a pagar) por categoria para exibição nos gráficos do mês
 */
export function calculateCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: 'expense' | 'income' = 'expense'
): CategoryBreakdownItem[] {
  const categoryMap = new Map<string, Category>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat);
  }

  const grouped = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      color: string;
      icon: string;
      paidAmount: number;
      pendingAmount: number;
      totalAmount: number;
    }
  >();

  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const amount = Number(tx.amount) || 0;
    grandTotal += amount;

    const cat = tx.category_id ? categoryMap.get(tx.category_id) : undefined;
    const key = cat ? cat.id : 'uncategorized';

    if (!grouped.has(key)) {
      grouped.set(key, {
        categoryId: key,
        categoryName: cat ? cat.name : 'Sem Categoria',
        color: cat ? cat.color : '#64748B',
        icon: cat ? cat.icon : 'pi-tag',
        paidAmount: 0,
        pendingAmount: 0,
        totalAmount: 0
      });
    }

    const entry = grouped.get(key)!;
    if (tx.status === 'paid') {
      entry.paidAmount = Math.round((entry.paidAmount + amount) * 100) / 100;
    } else {
      entry.pendingAmount =
        Math.round((entry.pendingAmount + amount) * 100) / 100;
    }
    entry.totalAmount = Math.round((entry.totalAmount + amount) * 100) / 100;
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map((item) => ({
      ...item,
      percentage:
        grandTotal > 0
          ? Math.round((item.totalAmount / grandTotal) * 1000) / 10
          : 0
    }));
}
