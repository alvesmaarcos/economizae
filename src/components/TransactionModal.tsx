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
import '@/lib/primereact-locale';
import {
  Category,
  CreateTransactionInput,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  RecurrenceType,
  Transaction,
  TransactionStatus,
  TransactionType
} from '@/types/finance';
import {
  parseISODateLocal,
  toISODateString
} from '@/lib/finance-calculations';

interface TransactionModalProps {
  visible: boolean;
  onHide: () => void;
  categories: Category[];
  editingTransaction: Transaction | null;
  initialPreset?: Partial<CreateTransactionInput>;
  defaultDate: Date;
  onSaveCreate: (input: CreateTransactionInput) => Promise<void>;
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
  editingTransaction,
  initialPreset,
  defaultDate,
  onSaveCreate,
  onSaveUpdate
}: TransactionModalProps) {
  const [flowMode, setFlowMode] = React.useState<QuickFlowMode>('bill_to_pay');
  const [type, setType] = React.useState<TransactionType>('expense');
  const [status, setStatus] = React.useState<TransactionStatus>('pending');
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState<number | null>(null);
  const [dueDate, setDueDate] = React.useState<Date>(defaultDate);
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] =
    React.useState<PaymentMethod | null>('pix');
  const [recurrenceType, setRecurrenceType] =
    React.useState<RecurrenceType>('single');
  const [installmentTotal, setInstallmentTotal] = React.useState<number>(2);
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

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
      setDueDate(parseISODateLocal(editingTransaction.due_date));
      setCategoryId(editingTransaction.category_id);
      setPaymentMethod(editingTransaction.payment_method);
      setRecurrenceType(editingTransaction.recurrence_type);
      setInstallmentTotal(editingTransaction.installment_total || 2);
      setNotes(editingTransaction.notes || '');
      return;
    }

    const presetType = initialPreset?.type || 'expense';
    const presetStatus = initialPreset?.status || 'pending';
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
    setDueDate(defaultDate);
    const defaultCat = categories.find((c) => c.type === presetType);
    setCategoryId(defaultCat ? defaultCat.id : null);
    setPaymentMethod('pix');
    setRecurrenceType('single');
    setInstallmentTotal(2);
    setNotes('');
  }, [visible, editingTransaction, initialPreset, defaultDate, categories]);

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

    setSaving(true);
    setErrorMsg(null);

    try {
      const isoDate = toISODateString(dueDate);
      if (editingTransaction) {
        await onSaveUpdate(editingTransaction.id, {
          description: description.trim(),
          amount: Number(amount),
          type,
          status,
          due_date: isoDate,
          category_id: categoryId,
          payment_method: paymentMethod,
          notes: notes.trim() || null
        });
      } else {
        await onSaveCreate({
          description: description.trim(),
          amount: Number(amount),
          type,
          status,
          due_date: isoDate,
          category_id: categoryId,
          payment_method: paymentMethod,
          recurrence_type: recurrenceType,
          installment_total:
            recurrenceType === 'installment' ? installmentTotal : null,
          notes: notes.trim() || null
        });
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
        label={editingTransaction ? 'Salvar Alterações' : 'Confirmar Lançamento'}
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
            {editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
          </span>
        </div>
      }
      visible={visible}
      onHide={onHide}
      footer={footer}
      style={{ width: '95vw', maxWidth: '580px' }}
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
                  : 'Ex: Conta de Luz, Aluguel, Mercado...'
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

        {/* Data de Vencimento e Situação */}
        <div className="grid">
          <div className="col-12 md:col-5">
            <label
              htmlFor="tx-date"
              className="block text-sm font-medium mb-1"
            >
              {status === 'pending'
                ? 'Data de Vencimento *'
                : 'Data do Lançamento *'}
            </label>
            <Calendar
              inputId="tx-date"
              value={dueDate}
              onChange={(e) => {
                if (e.value instanceof Date) setDueDate(e.value);
              }}
              dateFormat="dd/mm/yy"
              locale="pt-BR"
              showIcon
              className="w-full"
            />
          </div>

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
        </div>

        {/* Categoria e Forma de Pagamento */}
        <div className="grid">
          <div className="col-12 md:col-6">
            <label className="block text-sm font-medium mb-1">
              Categoria
            </label>
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
              onChange={(e) => setPaymentMethod(e.value)}
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
                  <label className="block text-xs font-medium mb-1">
                    Nº de Parcelas
                  </label>
                  <InputNumber
                    value={installmentTotal}
                    onValueChange={(e) => setInstallmentTotal(e.value || 2)}
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

            {recurrenceType === 'fixed' && (
              <p className="m-0 mt-2 text-xs text-color-secondary">
                <i className="pi pi-info-circle mr-1" />
                Será gerado automaticamente para os próximos 12 meses na mesma data de vencimento.
              </p>
            )}
            {recurrenceType === 'installment' && (
              <p className="m-0 mt-2 text-xs text-color-secondary">
                <i className="pi pi-info-circle mr-1" />
                Serão criadas {installmentTotal} parcelas mensais consecutivas (1/{installmentTotal} até {installmentTotal}/{installmentTotal}).
              </p>
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
