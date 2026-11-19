'use client';

import React from 'react';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { SelectButton } from 'primereact/selectbutton';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import {
  Category,
  PAYMENT_METHOD_LABELS,
  PaymentCard,
  PaymentMethod,
  Transaction
} from '@/types/finance';
import {
  formatBRL,
  formatDateBR,
  getDueStatus
} from '@/lib/finance-calculations';

export type TransactionTabFilter =
  | 'all'
  | 'income'
  | 'expense_paid'
  | 'bills_to_pay';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  cards: PaymentCard[];
  activeTab: TransactionTabFilter;
  onTabChange: (tab: TransactionTabFilter) => void;
  onToggleStatus: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
  onDeleteRequest: (tx: Transaction) => void;
}

const TAB_OPTIONS: {
  label: string;
  value: TransactionTabFilter;
  icon: string;
}[] = [
  { label: 'Todos', value: 'all', icon: 'pi pi-list' },
  { label: 'Entradas', value: 'income', icon: 'pi pi-arrow-up-right' },
  { label: 'Saídas Pagas', value: 'expense_paid', icon: 'pi pi-check-circle' },
  { label: 'Contas a Pagar', value: 'bills_to_pay', icon: 'pi pi-clock' }
];

export default function TransactionList({
  transactions,
  categories,
  cards,
  activeTab,
  onTabChange,
  onToggleStatus,
  onEdit,
  onDeleteRequest
}: TransactionListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<
    string | null
  >(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    React.useState<PaymentMethod | null>(null);
  const [selectedCardId, setSelectedCardId] = React.useState<string | null>(
    null
  );

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const cardMap = React.useMemo(() => {
    const map = new Map<string, PaymentCard>();
    cards.forEach((c) => map.set(c.id, c));
    return map;
  }, [cards]);

  const paymentOptions = React.useMemo(() => {
    return Object.entries(PAYMENT_METHOD_LABELS).map(([key, val]) => ({
      label: val.label,
      value: key as PaymentMethod,
      icon: val.icon
    }));
  }, []);

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter((tx) => {
      if (activeTab === 'income' && tx.type !== 'income') return false;
      if (
        activeTab === 'expense_paid' &&
        !(tx.type === 'expense' && tx.status === 'paid')
      ) {
        return false;
      }
      if (
        activeTab === 'bills_to_pay' &&
        !(tx.type === 'expense' && tx.status === 'pending')
      ) {
        return false;
      }

      if (selectedCategoryId && tx.category_id !== selectedCategoryId) {
        return false;
      }

      if (selectedPaymentMethod && tx.payment_method !== selectedPaymentMethod) {
        return false;
      }

      if (selectedCardId && tx.card_id !== selectedCardId) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const catName = tx.category_id
          ? categoryMap.get(tx.category_id)?.name?.toLowerCase() || ''
          : '';
        const cardName = tx.card_id
          ? cardMap.get(tx.card_id)?.name?.toLowerCase() || ''
          : '';
        const notes = tx.notes?.toLowerCase() || '';
        if (
          !tx.description.toLowerCase().includes(q) &&
          !catName.includes(q) &&
          !cardName.includes(q) &&
          !notes.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    transactions,
    activeTab,
    selectedCategoryId,
    selectedPaymentMethod,
    selectedCardId,
    searchQuery,
    categoryMap,
    cardMap
  ]);

  const dateBodyTemplate = (tx: Transaction) => {
    const hasDifferentPurchaseDate =
      tx.purchase_date && tx.purchase_date !== tx.due_date;

    return (
      <div className="flex flex-column">
        <span className="font-semibold text-sm">
          <i className="pi pi-calendar text-color-secondary mr-1 text-xs" />
          {formatDateBR(tx.due_date)}
        </span>
        {hasDifferentPurchaseDate && (
          <span className="text-xs text-color-secondary">
            Compra: {formatDateBR(tx.purchase_date)}
          </span>
        )}
        {tx.paid_at && tx.status === 'paid' && (
          <span className="text-xs text-green-600">
            Baixa: {formatDateBR(tx.paid_at)}
          </span>
        )}
      </div>
    );
  };

  const descriptionBodyTemplate = (tx: Transaction) => (
    <div>
      <div className="flex align-items-center flex-wrap gap-2">
        <span className="font-semibold">{tx.description}</span>
        {tx.recurrence_type === 'installment' && tx.installment_total && (
          <Tag
            value={`${tx.installment_current}/${tx.installment_total}`}
            severity="info"
            icon="pi pi-calendar-plus"
            className="text-xs"
          />
        )}
        {tx.recurrence_type === 'fixed' && (
          <Tag
            value="Fixa"
            severity="secondary"
            icon="pi pi-sync"
            className="text-xs"
          />
        )}
      </div>
      {tx.notes && (
        <p className="m-0 text-xs text-color-secondary mt-1">{tx.notes}</p>
      )}
    </div>
  );

  const categoryBodyTemplate = (tx: Transaction) => {
    const cat = tx.category_id ? categoryMap.get(tx.category_id) : null;
    if (!cat) {
      return (
        <span className="text-xs text-color-secondary">
          <i className="pi pi-tag mr-1" />
          Sem Categoria
        </span>
      );
    }
    return (
      <div className="flex align-items-center gap-2">
        <span
          className="inline-flex align-items-center justify-content-center border-round"
          style={{
            width: '1.75rem',
            height: '1.75rem',
            backgroundColor: `${cat.color}22`,
            color: cat.color
          }}
        >
          <i className={`pi ${cat.icon} text-xs`} />
        </span>
        <span className="text-sm font-medium">{cat.name}</span>
      </div>
    );
  };

  const paymentBodyTemplate = (tx: Transaction) => {
    if (!tx.payment_method) {
      return <span className="text-xs text-color-secondary">-</span>;
    }
    const meta = PAYMENT_METHOD_LABELS[tx.payment_method];
    const txCard = tx.card_id ? cardMap.get(tx.card_id) : null;

    return (
      <div className="flex flex-column gap-1">
        <span className="text-xs font-medium flex align-items-center gap-1">
          <i className={`pi ${meta.icon} text-color-secondary`} />
          {meta.label}
        </span>
        {txCard && (
          <div>
            <span
              className="inline-flex align-items-center gap-1 px-2 py-1 border-round text-xs font-semibold text-white"
              style={{ backgroundColor: txCard.color }}
            >
              <i className="pi pi-credit-card text-xs" />
              {txCard.name}
            </span>
          </div>
        )}
      </div>
    );
  };

  const statusBodyTemplate = (tx: Transaction) => {
    const info = getDueStatus(tx);
    return (
      <Tag
        value={info.label}
        severity={info.severity}
        icon={`pi ${info.icon}`}
        className="text-xs"
      />
    );
  };

  const amountBodyTemplate = (tx: Transaction) => {
    const isIncome = tx.type === 'income';
    return (
      <span
        className={`font-bold text-base ${
          isIncome
            ? 'text-green-500'
            : tx.status === 'pending'
              ? 'text-orange-500'
              : 'text-color'
        }`}
      >
        {isIncome ? '+ ' : '- '}
        {formatBRL(tx.amount)}
      </span>
    );
  };

  const actionsBodyTemplate = (tx: Transaction) => {
    const isPaid = tx.status === 'paid';
    const toggleLabel =
      tx.type === 'income'
        ? isPaid
          ? 'Marcar como A Receber'
          : 'Confirmar Recebimento'
        : isPaid
          ? 'Voltar para Conta a Pagar'
          : 'Pagar Conta';

    return (
      <div className="flex align-items-center justify-content-end gap-1">
        <Button
          icon={isPaid ? 'pi pi-undo' : 'pi pi-check'}
          rounded
          outlined={isPaid}
          severity={isPaid ? 'secondary' : 'success'}
          size="small"
          onClick={() => onToggleStatus(tx)}
          tooltip={toggleLabel}
          tooltipOptions={{ position: 'top' }}
          aria-label={toggleLabel}
        />
        <Button
          icon="pi pi-pencil"
          rounded
          text
          severity="info"
          size="small"
          onClick={() => onEdit(tx)}
          tooltip="Editar"
          tooltipOptions={{ position: 'top' }}
          aria-label="Editar"
        />
        <Button
          icon="pi pi-trash"
          rounded
          text
          severity="danger"
          size="small"
          onClick={() => onDeleteRequest(tx)}
          tooltip="Excluir"
          tooltipOptions={{ position: 'top' }}
          aria-label="Excluir"
        />
      </div>
    );
  };

  const header = (
    <div className="flex flex-column gap-3">
      <div className="flex flex-wrap align-items-center justify-content-between gap-2">
        <div className="flex align-items-center gap-2">
          <i className="pi pi-list text-primary text-xl" />
          <div>
            <span className="text-lg font-bold">Lançamentos do Mês</span>
            <p className="m-0 text-xs text-color-secondary">
              Extrato unificado de Entradas, Saídas Pagas, Cartões e Contas a
              Pagar
            </p>
          </div>
        </div>

        <SelectButton
          value={activeTab}
          options={TAB_OPTIONS}
          onChange={(e) => {
            if (e.value) onTabChange(e.value);
          }}
          itemTemplate={(option) => (
            <div className="flex align-items-center gap-2 px-1">
              <i className={option.icon} />
              <span className="text-xs font-semibold">{option.label}</span>
            </div>
          )}
        />
      </div>

      <div className="grid">
        <div className="col-12 md:col-4">
          <span className="p-input-icon-left w-full">
            <i className="pi pi-search" />
            <InputText
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar descrição, cartão ou nota..."
              className="w-full p-inputtext-sm"
            />
          </span>
        </div>
        <div className="col-12 sm:col-4 md:col-3">
          <Dropdown
            value={selectedCategoryId}
            options={categories}
            optionLabel="name"
            optionValue="id"
            onChange={(e) => setSelectedCategoryId(e.value)}
            placeholder="Todas as Categorias"
            showClear
            className="w-full p-inputtext-sm"
          />
        </div>
        <div className="col-12 sm:col-4 md:col-3">
          <Dropdown
            value={selectedPaymentMethod}
            options={paymentOptions}
            onChange={(e) => setSelectedPaymentMethod(e.value)}
            placeholder="Forma de Pagamento"
            showClear
            className="w-full p-inputtext-sm"
          />
        </div>
        <div className="col-12 sm:col-4 md:col-2">
          <Dropdown
            value={selectedCardId}
            options={cards}
            optionLabel="name"
            optionValue="id"
            onChange={(e) => setSelectedCardId(e.value)}
            placeholder="Cartão"
            showClear
            className="w-full p-inputtext-sm"
          />
        </div>
      </div>
    </div>
  );

  return (
    <Card className="shadow-1 border-round-xl mb-5">
      <DataTable
        value={filteredTransactions}
        header={header}
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        emptyMessage="Nenhum lançamento encontrado com os filtros selecionados."
        responsiveLayout="scroll"
        stripedRows
        sortField="due_date"
        sortOrder={1}
        size="small"
      >
        <Column
          field="due_date"
          header="Vencimento / Compra"
          body={dateBodyTemplate}
          sortable
          style={{ minWidth: '150px' }}
        />
        <Column
          field="description"
          header="Descrição"
          body={descriptionBodyTemplate}
          sortable
          style={{ minWidth: '220px' }}
        />
        <Column
          field="category_id"
          header="Categoria"
          body={categoryBodyTemplate}
          style={{ minWidth: '170px' }}
        />
        <Column
          field="payment_method"
          header="Meio / Cartão"
          body={paymentBodyTemplate}
          style={{ minWidth: '160px' }}
        />
        <Column
          field="status"
          header="Situação"
          body={statusBodyTemplate}
          sortable
          style={{ minWidth: '150px' }}
        />
        <Column
          field="amount"
          header="Valor"
          body={amountBodyTemplate}
          sortable
          style={{ minWidth: '130px' }}
        />
        <Column
          header="Ações"
          body={actionsBodyTemplate}
          style={{ minWidth: '140px', textAlign: 'right' }}
        />
      </DataTable>
    </Card>
  );
}
