'use client';

import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { SelectButton } from 'primereact/selectbutton';
import { InputTextarea } from 'primereact/inputtextarea';
import { Tag } from 'primereact/tag';
import '@/lib/primereact-locale';
import {
  Category,
  CreateTransactionInput,
  PAYMENT_METHOD_LABELS,
  PaymentCard,
  PaymentMethod,
  RecurrenceType,
  Transaction,
  TransactionStatus,
  TransactionType
} from '@/types/finance';
import {
  addMonthsToISODate,
  calculateCreditCardFirstDueDate,
  formatBRL,
  formatCompetenceMonthBR,
  formatDateBR,
  getCompetenceMonthFromDate,
  parseISODateLocal,
  toISODateString
} from '@/lib/finance-calculations';

interface TransactionModalProps {
  visible: boolean;
  onHide: () => void;
  categories: Category[];
  cards: PaymentCard[];
  editingTransaction: Transaction | null;
  initialPreset?: Partial<CreateTransactionInput>;
  defaultDate: Date;
  onOpenManageCards: () => void;
  onSaveCreate: (
    input: CreateTransactionInput,
    firstInvoiceMonth?: string
  ) => Promise<void>;
  onSaveUpdate: (
    id: string,
    updates: Partial<Transaction>
  ) => Promise<void>;
}

type QuickFlowMode = 'bill_to_pay' | 'expense_paid' | 'income';

const QUICK_FLOW_OPTIONS: {
  label: string;
  value: QuickFlowMode;
  icon: string;
}[] = [
  {
    label: 'Conta a Pagar (Pendente)',
    value: 'bill_to_pay',
    icon: 'pi pi-clock'
  },
  {
    label: 'Saída já Paga',
    value: 'expense_paid',
    icon: 'pi pi-arrow-down-left'
  },
  {
    label: 'Entrada (Receita)',
    value: 'income',
    icon: 'pi pi-arrow-up-right'
  }
];

const RECURRENCE_OPTIONS: {
  label: string;
  value: RecurrenceType;
  icon: string;
}[] = [
  { label: 'Único', value: 'single', icon: 'pi pi-calendar' },
  { label: 'Fixo Mensal', value: 'fixed', icon: 'pi pi-sync' },
  { label: 'Parcelado', value: 'installment', icon: 'pi pi-calendar-plus' }
];

export default function TransactionModal({
  visible,
  onHide,
  categories,
  cards,
  editingTransaction,
  initialPreset,
  defaultDate,
  onOpenManageCards,
  onSaveCreate,
  onSaveUpdate
}: TransactionModalProps) {
  const [flowMode, setFlowMode] = React.useState<QuickFlowMode>('bill_to_pay');
  const [type, setType] = React.useState<TransactionType>('expense');
  const [status, setStatus] = React.useState<TransactionStatus>('pending');
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState<number | null>(null);
  const [purchaseOrDueDate, setPurchaseOrDueDate] =
    React.useState<Date>(defaultDate);
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] =
    React.useState<PaymentMethod | null>('pix');
  const [cardId, setCardId] = React.useState<string | null>(null);
  const [recurrenceType, setRecurrenceType] =
    React.useState<RecurrenceType>('single');
  const [installmentTotal, setInstallmentTotal] = React.useState<number>(2);
  const [paidInstallments, setPaidInstallments] = React.useState<number>(0);
  const creatingInstallments = !editingTransaction && recurrenceType === 'installment';
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const isCardPayment =
    paymentMethod === 'credit_card' || paymentMethod === 'debit_card';

  const compatibleCards = React.useMemo(() => {
    if (paymentMethod === 'credit_card') {
      return cards.filter(
        (c) => c.modality === 'both' || c.modality === 'credit'
      );
    }
    if (paymentMethod === 'debit_card') {
      return cards.filter(
        (c) => c.modality === 'both' || c.modality === 'debit'
      );
    }
    return cards;
  }, [cards, paymentMethod]);

  const selectedCard = React.useMemo(
    () => compatibleCards.find((c) => c.id === cardId) || null,
    [compatibleCards, cardId]
  );

  const filteredCategories = React.useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  React.useEffect(() => {
    if (!visible) return;
    setErrorMsg(null);

    if (editingTransaction) {
      setType(editingTransaction.type);
      setStatus(editingTransaction.status);
      if (editingTransaction.type === 'income') {
        setFlowMode('income');
      } else if (editingTransaction.status === 'pending') {
        setFlowMode('bill_to_pay');
      } else {
        setFlowMode('expense_paid');
      }
      setDescription(editingTransaction.description);
      setAmount(Number(editingTransaction.amount));
      const baseDateStr =
        editingTransaction.card_id && editingTransaction.payment_method === 'credit_card'
          ? editingTransaction.purchase_date || editingTransaction.due_date
          : editingTransaction.due_date;
      setPurchaseOrDueDate(parseISODateLocal(baseDateStr));
      setCategoryId(editingTransaction.category_id);
      setPaymentMethod(editingTransaction.payment_method);
      setCardId(editingTransaction.card_id || null);
      setRecurrenceType(editingTransaction.recurrence_type);
      setInstallmentTotal(editingTransaction.installment_total || 2);
      setNotes(editingTransaction.notes || '');
      return;
    }

    const presetType = initialPreset?.type || 'expense';
    const presetStatus = initialPreset?.status || 'pending';
    const presetMethod = initialPreset?.payment_method || 'pix';

    setType(presetType);
    setStatus(presetStatus);

    if (presetType === 'income') {
      setFlowMode('income');
    } else if (presetStatus === 'pending') {
      setFlowMode('bill_to_pay');
    } else {
      setFlowMode('expense_paid');
    }

    setDescription('');
    setAmount(null);
    setPurchaseOrDueDate(defaultDate);
    const defaultCat = categories.find((c) => c.type === presetType);
    setCategoryId(defaultCat ? defaultCat.id : null);
    setPaymentMethod(presetMethod);
    setCardId(initialPreset?.card_id || (cards[0]?.id ?? null));
    setRecurrenceType('single');
    setInstallmentTotal(2);
    setPaidInstallments(0);
    setNotes('');
  }, [
    visible,
    editingTransaction,
    initialPreset,
    defaultDate,
    categories,
    cards
  ]);

  // Garante que quando o usuário escolher Cartão de Crédito ou Débito já haja um cartão compatível pré-selecionado
  React.useEffect(() => {
    if (!isCardPayment) return;
    const stillValid = compatibleCards.some((c) => c.id === cardId);
    if (!stillValid && compatibleCards.length > 0) {
      setCardId(compatibleCards[0].id);
    }
  }, [isCardPayment, compatibleCards, cardId]);

  const handlePaymentMethodChange = (nextMethod: PaymentMethod | null) => {
    setPaymentMethod(nextMethod);
    if (nextMethod === 'credit_card' && type === 'expense') {
      setStatus('pending');
      setFlowMode('bill_to_pay');
    } else if (nextMethod === 'debit_card' && type === 'expense') {
      setStatus('paid');
      setFlowMode('expense_paid');
    }
  };

  const handleFlowModeChange = (nextMode: QuickFlowMode) => {
    if (!nextMode) return;
    setFlowMode(nextMode);
    if (nextMode === 'bill_to_pay') {
      setType('expense');
      setStatus('pending');
      const expCat = categories.find((c) => c.type === 'expense');
      if (expCat) setCategoryId(expCat.id);
    } else if (nextMode === 'expense_paid') {
      setType('expense');
      setStatus('paid');
      const expCat = categories.find((c) => c.type === 'expense');
      if (expCat) setCategoryId(expCat.id);
    } else {
      setType('income');
      setStatus('paid');
      const incCat = categories.find((c) => c.type === 'income');
      if (incCat) setCategoryId(incCat.id);
    }
  };

  const paymentOptions = React.useMemo(() => {
    return Object.entries(PAYMENT_METHOD_LABELS).map(([key, val]) => ({
      label: val.label,
      value: key as PaymentMethod,
      icon: val.icon
    }));
  }, []);

  // Cálculo em tempo real de quando será paga a fatura do cartão de crédito
  const creditInvoicePreview = React.useMemo(() => {
    if (
      paymentMethod !== 'credit_card' ||
      !selectedCard ||
      !selectedCard.closing_day ||
      !selectedCard.due_day
    ) {
      return null;
    }

    const purchaseISO = toISODateString(purchaseOrDueDate);
    const firstDueISO = calculateCreditCardFirstDueDate(
      purchaseISO,
      selectedCard.closing_day,
      selectedCard.due_day
    );
    const firstMonth = getCompetenceMonthFromDate(firstDueISO);
    const lastDueISO =
      recurrenceType === 'installment'
        ? addMonthsToISODate(firstDueISO, Math.max(1, installmentTotal - 1))
        : firstDueISO;

    const purchaseDay = purchaseOrDueDate.getDate();
    const afterClosing = purchaseDay >= selectedCard.closing_day;

    return {
      purchaseISO,
      firstDueISO,
      firstMonth,
      firstMonthLabel: formatCompetenceMonthBR(firstMonth),
      lastDueISO,
      afterClosing
    };
  }, [
    paymentMethod,
    selectedCard,
    purchaseOrDueDate,
    recurrenceType,
    installmentTotal
  ]);

  const firstInstallmentDue = creditInvoicePreview?.firstDueISO ?? toISODateString(purchaseOrDueDate);
  const firstPendingDue = creatingInstallments && paidInstallments < installmentTotal
    ? addMonthsToISODate(firstInstallmentDue, paidInstallments)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Informe uma descrição para o lançamento.');
      return;
    }
    if (!amount || amount <= 0) {
      setErrorMsg('Informe um valor maior que R$ 0,00.');
      return;
    }
    if (isCardPayment && !cardId) {
      setErrorMsg(
        'Selecione qual cartão foi utilizado (ou cadastre um novo cartão).'
      );
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const selectedDateISO = toISODateString(purchaseOrDueDate);
      const effectiveDueDateISO =
        paymentMethod === 'credit_card' && creditInvoicePreview
          ? creditInvoicePreview.firstDueISO
          : selectedDateISO;

      if (editingTransaction) {
        const originalPurchaseDate = editingTransaction.purchase_date || editingTransaction.due_date;
        const unchangedSchedule = paymentMethod === editingTransaction.payment_method &&
          (isCardPayment ? cardId : null) === editingTransaction.card_id &&
          selectedDateISO === (paymentMethod === 'credit_card'
            ? originalPurchaseDate
            : editingTransaction.due_date);
        const installmentOffset = (editingTransaction.installment_current ?? 1) - 1;
        const dueDate = unchangedSchedule
          ? editingTransaction.due_date
          : addMonthsToISODate(
              effectiveDueDateISO,
              creditInvoicePreview ? installmentOffset : 0
            );
        await onSaveUpdate(editingTransaction.id, {
          description: description.trim(),
          amount: Number(amount),
          type,
          status,
          purchase_date: unchangedSchedule ? editingTransaction.purchase_date : selectedDateISO,
          due_date: dueDate,
          paid_at: status === 'paid' && editingTransaction.status === 'paid'
            ? editingTransaction.paid_at
            : undefined,
          category_id: categoryId,
          payment_method: paymentMethod,
          card_id: isCardPayment ? cardId : null,
          notes: notes.trim() || null
        });
      } else {
        const invoiceDate = creatingInstallments
          ? firstPendingDue
          : creditInvoicePreview?.firstDueISO;
        await onSaveCreate(
          {
            description: description.trim(),
            amount: Number(amount),
            type,
            status,
            purchase_date: selectedDateISO,
            due_date: effectiveDueDateISO,
            category_id: categoryId,
            payment_method: paymentMethod,
            card_id: isCardPayment ? cardId : null,
            recurrence_type: recurrenceType,
            installment_total:
              recurrenceType === 'installment' ? installmentTotal : null,
            paid_installments: creatingInstallments ? paidInstallments : undefined,
            notes: notes.trim() || null
          },
          creditInvoicePreview && invoiceDate
            ? getCompetenceMonthFromDate(invoiceDate)
            : undefined
        );
      }
      onHide();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao salvar o lançamento.'
      );
    } finally {
      setSaving(false);
    }
  };

  const categoryOptionTemplate = (option: Category | null) => {
    if (!option) return <span>Selecione uma categoria</span>;
    return (
      <div className="flex align-items-center gap-2">
        <span
          className="inline-flex align-items-center justify-content-center border-round"
          style={{
            width: '1.5rem',
            height: '1.5rem',
            backgroundColor: `${option.color}22`,
            color: option.color
          }}
        >
          <i className={`pi ${option.icon} text-xs`} />
        </span>
        <span>{option.name}</span>
      </div>
    );
  };

  const cardOptionTemplate = (option: PaymentCard | null) => {
    if (!option) return <span>Escolha o cartão utilizado</span>;
    return (
      <div className="flex align-items-center justify-content-between w-full gap-2">
        <div className="flex align-items-center gap-2">
          <span
            className="inline-flex align-items-center justify-content-center border-round text-white"
            style={{
              width: '1.5rem',
              height: '1.5rem',
              backgroundColor: option.color
            }}
          >
            <i className="pi pi-credit-card text-xs" />
          </span>
          <span className="font-semibold">{option.name}</span>
        </div>
        {option.closing_day && option.due_day && (
          <span className="text-xs text-color-secondary">
            Fecha dia {option.closing_day} • Vence dia {option.due_day}
          </span>
        )}
      </div>
    );
  };

  const statusOptions =
    type === 'income'
      ? [
          {
            label: 'Já Recebida',
            value: 'paid' as TransactionStatus,
            icon: 'pi pi-check-circle'
          },
          {
            label: 'A Receber (Pendente)',
            value: 'pending' as TransactionStatus,
            icon: 'pi pi-clock'
          }
        ]
      : [
          {
            label: 'Conta a Pagar (Pendente)',
            value: 'pending' as TransactionStatus,
            icon: 'pi pi-clock'
          },
          {
            label: 'Saída já Paga',
            value: 'paid' as TransactionStatus,
            icon: 'pi pi-check-circle'
          }
        ];

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button
        label="Cancelar"
        icon="pi pi-times"
        text
        severity="secondary"
        onClick={onHide}
        disabled={saving}
      />
      <Button
        label={
          editingTransaction ? 'Salvar Alterações' : 'Confirmar Lançamento'
        }
        icon="pi pi-check"
        severity="success"
        loading={saving}
        onClick={handleSubmit}
      />
    </div>
  );

  return (
    <Dialog
      header={
        <div className="flex align-items-center gap-2">
          <i className="pi pi-plus-circle text-primary text-xl" />
          <span>
            {editingTransaction
              ? 'Editar Lançamento'
              : 'Novo Lançamento Financeiro'}
          </span>
        </div>
      }
      visible={visible}
      onHide={onHide}
      footer={footer}
      style={{ width: '95vw', maxWidth: '620px' }}
      modal
      draggable={false}
    >
      <form onSubmit={handleSubmit} className="flex flex-column gap-3 pt-2">
        {errorMsg && (
          <div className="p-3 border-round-lg bg-red-100 text-red-700 text-sm flex align-items-center gap-2">
            <i className="pi pi-exclamation-circle" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Seletor rápido de tipo de fluxo */}
        <div>
          <label className="block text-xs font-semibold text-color-secondary mb-2">
            O QUE VOCÊ DESEJA REGISTRAR?
          </label>
          <SelectButton
            value={flowMode}
            options={QUICK_FLOW_OPTIONS}
            onChange={(e) => handleFlowModeChange(e.value)}
            className="w-full"
            itemTemplate={(opt) => (
              <div className="flex align-items-center gap-2">
                <i className={opt.icon} />
                <span className="text-xs font-semibold">{opt.label}</span>
              </div>
            )}
          />
        </div>

        {/* Descrição e Valor */}
        <div className="grid">
          <div className="col-12 md:col-7">
            <label
              htmlFor="tx-desc"
              className="block text-sm font-medium mb-1"
            >
              Descrição *
            </label>
            <InputText
              id="tx-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'income'
                  ? 'Ex: Salário, Freelance...'
                  : 'Ex: Supermercado, Farmácia, Conta de Luz...'
              }
              className="w-full"
              autoFocus
            />
          </div>

          <div className="col-12 md:col-5">
            <label
              htmlFor="tx-amount"
              className="block text-sm font-medium mb-1"
            >
              {recurrenceType === 'installment'
                ? 'Valor de cada Parcela *'
                : 'Valor (R$) *'}
            </label>
            <InputNumber
              inputId="tx-amount"
              value={amount}
              onValueChange={(e) => setAmount(e.value ?? null)}
              mode="currency"
              currency="BRL"
              locale="pt-BR"
              placeholder="R$ 0,00"
              className="w-full"
              inputClassName="w-full font-bold"
            />
          </div>
        </div>

        {/* Categoria e Forma de Pagamento */}
        <div className="grid">
          <div className="col-12 md:col-6">
            <label className="block text-sm font-medium mb-1">Categoria</label>
            <Dropdown
              value={categoryId}
              options={filteredCategories}
              optionLabel="name"
              optionValue="id"
              onChange={(e) => setCategoryId(e.value)}
              itemTemplate={categoryOptionTemplate}
              valueTemplate={(opt) => categoryOptionTemplate(opt)}
              placeholder="Selecione a categoria"
              className="w-full"
            />
          </div>

          <div className="col-12 md:col-6">
            <label className="block text-sm font-medium mb-1">
              Forma de Pagamento / Recebimento
            </label>
            <Dropdown
              value={paymentMethod}
              options={paymentOptions}
              onChange={(e) => handlePaymentMethodChange(e.value)}
              placeholder="Selecione o meio"
              showClear
              className="w-full"
              itemTemplate={(opt) => (
                <div className="flex align-items-center gap-2">
                  <i className={`pi ${opt.icon}`} />
                  <span>{opt.label}</span>
                </div>
              )}
            />
          </div>
        </div>

        {/* SEÇÃO ESPECIAL: ESCOLHA DO CARTÃO (CRÉDITO OU DÉBITO) */}
        {isCardPayment && (
          <div
            className="p-3 border-round-xl border-1"
            style={{
              backgroundColor: selectedCard
                ? `${selectedCard.color}12`
                : 'var(--surface-ground)',
              borderColor: selectedCard
                ? `${selectedCard.color}55`
                : 'var(--surface-border)'
            }}
          >
            <div className="flex align-items-center justify-content-between mb-2">
              <label className="text-xs font-bold flex align-items-center gap-2">
                <i className="pi pi-credit-card text-primary" />
                <span>
                  EM QUAL CARTÃO ({paymentMethod === 'credit_card' ? 'CRÉDITO' : 'DÉBITO'}) FOI REALIZADO O PAGAMENTO? *
                </span>
              </label>
              <Button
                type="button"
                label="Gerenciar / + Cartão"
                icon="pi pi-cog"
                link
                size="small"
                className="p-0 text-xs"
                onClick={onOpenManageCards}
              />
            </div>

            <Dropdown
              value={cardId}
              options={compatibleCards}
              optionLabel="name"
              optionValue="id"
              onChange={(e) => setCardId(e.value)}
              itemTemplate={cardOptionTemplate}
              valueTemplate={(opt) => cardOptionTemplate(opt)}
              placeholder="Selecione o cartão utilizado"
              className="w-full"
            />

            {/* Resumo automático do cálculo de vencimento da fatura (Cartão de Crédito) */}
            {paymentMethod === 'credit_card' &&
              selectedCard &&
              creditInvoicePreview && (
                <div className="mt-3 p-2 border-round-lg surface-card border-1 surface-border flex flex-column gap-1">
                  <div className="flex align-items-center justify-content-between flex-wrap gap-2">
                    <span className="text-xs text-color-secondary">
                      <i className="pi pi-calendar-clock mr-1 text-primary" />
                      Fechamento dia{' '}
                      <strong>{selectedCard.closing_day}</strong> • Vencimento
                      dia <strong>{selectedCard.due_day}</strong>
                    </span>
                    <Tag
                      severity={
                        creditInvoicePreview.afterClosing ? 'warning' : 'info'
                      }
                      value={
                        creditInvoicePreview.afterClosing
                          ? 'Compra após fechamento → Próxima fatura'
                          : 'Compra antes do fechamento → Fatura atual'
                      }
                      className="text-xs"
                    />
                  </div>

                  {!creatingInstallments && (
                    <div className="text-sm mt-1">
                      <i className="pi pi-bolt text-orange-500 mr-1" />
                      Você pagará este valor em:{' '}
                      <strong className="text-orange-500">
                        {formatDateBR(creditInvoicePreview.firstDueISO)} (Fatura
                        de {creditInvoicePreview.firstMonthLabel})
                      </strong>
                    </div>
                  )}

                  {creatingInstallments && (
                    <div className="text-xs text-color-secondary mt-1">
                      Parcelamento em <strong>{installmentTotal}x</strong>: 1ª
                      parcela em{' '}
                      <strong>
                        {formatDateBR(creditInvoicePreview.firstDueISO)}
                      </strong>{' '}
                      até a {installmentTotal}ª parcela em{' '}
                      <strong>
                        {formatDateBR(creditInvoicePreview.lastDueISO)}
                      </strong>
                      {amount
                        ? ` (Total: ${formatBRL(amount * installmentTotal)})`
                        : ''}
                      .
                    </div>
                  )}
                </div>
              )}

            {/* Resumo para Cartão de Débito */}
            {paymentMethod === 'debit_card' && selectedCard && (
              <div className="mt-2 text-xs text-color-secondary flex align-items-center gap-2">
                <i className="pi pi-check-circle text-green-500" />
                <span>
                  Pagamento no <strong>Débito ({selectedCard.name})</strong>: o
                  valor é descontado imediatamente na data da compra (
                  <strong>{formatDateBR(toISODateString(purchaseOrDueDate))}</strong>
                  ).
                </span>
              </div>
            )}
          </div>
        )}

        {/* Data da Compra / Vencimento e Situação */}
        <div className="grid">
          <div className="col-12 md:col-5">
            <label
              htmlFor="tx-date"
              className="block text-sm font-medium mb-1"
            >
              {isCardPayment
                ? 'Data da Compra *'
                : creatingInstallments
                  ? 'Data do Primeiro Vencimento *'
                  : status === 'pending'
                  ? 'Data de Vencimento *'
                  : 'Data do Lançamento *'}
            </label>
            <Calendar
              inputId="tx-date"
              value={purchaseOrDueDate}
              onChange={(e) => {
                if (e.value instanceof Date) setPurchaseOrDueDate(e.value);
              }}
              dateFormat="dd/mm/yy"
              locale="pt-BR"
              showIcon
              className="w-full"
            />
          </div>

          {!creatingInstallments && (
            <div className="col-12 md:col-7">
              <label className="block text-sm font-medium mb-1">
                Situação Atual
              </label>
              <SelectButton
                value={status}
                options={statusOptions}
                onChange={(e) => {
                  if (e.value) setStatus(e.value);
                }}
                className="w-full"
                itemTemplate={(opt) => (
                  <div className="flex align-items-center gap-1">
                    <i className={opt.icon} />
                    <span className="text-xs font-semibold">{opt.label}</span>
                  </div>
                )}
              />
            </div>
          )}
        </div>

        {/* Recorrência e Parcelamento (apenas na criação) */}
        {!editingTransaction && (
          <div className="surface-ground p-3 border-round-lg border-1 surface-border">
            <label className="block text-xs font-semibold text-color-secondary mb-2">
              REPETIÇÃO / PARCELAMENTO
            </label>
            <div className="grid align-items-center">
              <div
                className={
                  recurrenceType === 'installment'
                    ? 'col-12 md:col-8'
                    : 'col-12'
                }
              >
                <SelectButton
                  value={recurrenceType}
                  options={RECURRENCE_OPTIONS}
                  onChange={(e) => {
                    if (e.value) setRecurrenceType(e.value);
                  }}
                  className="w-full"
                  itemTemplate={(opt) => (
                    <div className="flex align-items-center gap-2">
                      <i className={opt.icon} />
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </div>
                  )}
                />
              </div>

              {recurrenceType === 'installment' && (
                <div className="col-12 md:col-4">
                  <label htmlFor="tx-installment-total" className="block text-xs font-medium mb-1">
                    Nº de Parcelas
                  </label>
                  <InputNumber
                    inputId="tx-installment-total"
                    value={installmentTotal}
                    onValueChange={(e) => {
                      const total = e.value || 2;
                      setInstallmentTotal(total);
                      setPaidInstallments((paid) => Math.min(paid, total));
                    }}
                    showButtons
                    min={2}
                    max={60}
                    suffix="x"
                    className="w-full"
                    inputClassName="w-full text-center font-bold"
                  />
                </div>
              )}
            </div>
            {creatingInstallments && (
              <div className="mt-2">
                <label htmlFor="tx-paid-installments" className="block text-sm font-medium mb-1">
                  Parcelas já pagas
                </label>
                <InputNumber
                  inputId="tx-paid-installments"
                  value={paidInstallments}
                  onValueChange={(e) => setPaidInstallments(e.value ?? 0)}
                  min={0}
                  max={installmentTotal}
                  showButtons
                  aria-describedby="tx-installment-help"
                />
                <p id="tx-installment-help" className="text-xs text-color-secondary mt-2 mb-1">
                  As parcelas já pagas serão registradas no histórico com a data do vencimento.
                </p>
                <p className="text-sm m-0" aria-live="polite">
                  {firstPendingDue
                    ? `Próxima parcela pendente: ${paidInstallments + 1}/${installmentTotal} em ${formatDateBR(firstPendingDue)}.`
                    : 'Todas as parcelas estão quitadas.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Observações */}
        <div>
          <label
            htmlFor="tx-notes"
            className="block text-sm font-medium mb-1"
          >
            Observações (opcional)
          </label>
          <InputTextarea
            id="tx-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Código de barras, link do boleto ou lembrete..."
            className="w-full"
          />
        </div>
      </form>
    </Dialog>
  );
}
