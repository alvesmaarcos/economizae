'use client';

import React from 'react';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import {
  Category,
  CreateTransactionInput,
  PAYMENT_METHOD_LABELS,
  Transaction
} from '@/types/finance';
import {
  formatBRL,
  formatDateBR,
  getDueStatus
} from '@/lib/finance-calculations';

interface BillsToPaySectionProps {
  transactions: Transaction[];
  categories: Category[];
  onTogglePaid: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
  onOpenNewBill: (preset?: Partial<CreateTransactionInput>) => void;
}

export default function BillsToPaySection({
  transactions,
  categories,
  onTogglePaid,
  onEdit,
  onOpenNewBill
}: BillsToPaySectionProps) {
  const categoryMap = React.useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const pendingBills = React.useMemo(() => {
    return transactions
      .filter((tx) => tx.type === 'expense' && tx.status === 'pending')
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [transactions]);

  const totalPending = React.useMemo(
    () => pendingBills.reduce((acc, tx) => acc + Number(tx.amount), 0),
    [pendingBills]
  );

  const dueStatusBodyTemplate = (tx: Transaction) => {
    const statusInfo = getDueStatus(tx);
    return (
      <div className="flex flex-column gap-1">
        <span className="font-semibold text-sm">
          <i className="pi pi-calendar mr-1 text-color-secondary" />
          {formatDateBR(tx.due_date)}
        </span>
        <div>
          <Tag
            value={statusInfo.label}
            severity={statusInfo.severity}
            icon={`pi ${statusInfo.icon}`}
            className="text-xs"
          />
        </div>
      </div>
    );
  };

  const descriptionBodyTemplate = (tx: Transaction) => {
    const cat = tx.category_id ? categoryMap.get(tx.category_id) : null;
    const paymentMeta = tx.payment_method
      ? PAYMENT_METHOD_LABELS[tx.payment_method]
      : null;

    return (
      <div className="flex align-items-center gap-3">
        <div
          className="flex align-items-center justify-content-center border-round-lg flex-shrink-0"
          style={{
            width: '2.25rem',
            height: '2.25rem',
            backgroundColor: cat ? `${cat.color}22` : '#64748B22',
            color: cat ? cat.color : '#64748B'
          }}
        >
          <i className={`pi ${cat ? cat.icon : 'pi-tag'}`} />
        </div>
        <div>
          <div className="flex align-items-center flex-wrap gap-2">
            <span className="font-semibold">{tx.description}</span>
            {tx.recurrence_type === 'installment' && tx.installment_total && (
              <Tag
                value={`Parcela ${tx.installment_current}/${tx.installment_total}`}
                severity="info"
                icon="pi pi-calendar-plus"
                className="text-xs"
              />
            )}
            {tx.recurrence_type === 'fixed' && (
              <Tag
                value="Fixa Mensal"
                severity="secondary"
                icon="pi pi-sync"
                className="text-xs"
              />
            )}
          </div>
          <div className="text-xs text-color-secondary mt-1 flex align-items-center gap-2">
            <span>{cat ? cat.name : 'Sem Categoria'}</span>
            {paymentMeta && (
              <>
                <span>•</span>
                <span>
                  <i className={`pi ${paymentMeta.icon} mr-1 text-xs`} />
                  {paymentMeta.label}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const amountBodyTemplate = (tx: Transaction) => (
    <span className="font-bold text-orange-500 text-base">
      {formatBRL(tx.amount)}
    </span>
  );

  const actionsBodyTemplate = (tx: Transaction) => (
    <div className="flex align-items-center justify-content-end gap-2">
      <Button
        label="Pagar"
        icon="pi pi-check"
        severity="success"
        size="small"
        onClick={() => onTogglePaid(tx)}
        tooltip="Marcar esta conta como paga hoje"
        tooltipOptions={{ position: 'top' }}
      />
      <Button
        icon="pi pi-pencil"
        rounded
        text
        severity="secondary"
        size="small"
        onClick={() => onEdit(tx)}
        aria-label="Editar conta"
      />
    </div>
  );

  const header = (
    <div className="flex flex-wrap align-items-center justify-content-between gap-2">
      <div className="flex align-items-center gap-2">
        <i className="pi pi-clock text-orange-500 text-xl" />
        <div>
          <span className="text-lg font-bold">
            Contas a Pagar (Saídas Pendentes)
          </span>
          <p className="m-0 text-xs text-color-secondary">
            Compromissos em aberto no mês ordenados por data de vencimento
          </p>
        </div>
      </div>
      <div className="flex align-items-center gap-2">
        <Tag
          severity={pendingBills.length > 0 ? 'warning' : 'success'}
          value={`${pendingBills.length} pendente(s) • ${formatBRL(totalPending)}`}
          className="text-sm px-3 py-1"
        />
        <Button
          label="Nova Conta"
          icon="pi pi-plus"
          size="small"
          outlined
          severity="warning"
          onClick={() =>
            onOpenNewBill({ type: 'expense', status: 'pending' })
          }
        />
      </div>
    </div>
  );

  return (
    <Card className="mb-4 shadow-1 border-round-xl">
      <DataTable
        value={pendingBills}
        header={header}
        emptyMessage="Parabéns! Nenhuma conta a pagar pendente para este mês."
        responsiveLayout="scroll"
        size="small"
        stripedRows
        paginator={pendingBills.length > 5}
        rows={5}
      >
        <Column
          header="Vencimento / Status"
          body={dueStatusBodyTemplate}
          style={{ minWidth: '175px' }}
        />
        <Column
          header="Conta / Categoria"
          body={descriptionBodyTemplate}
          style={{ minWidth: '250px' }}
        />
        <Column
          header="Valor"
          body={amountBodyTemplate}
          style={{ minWidth: '120px' }}
        />
        <Column
          header="Dar Baixa"
          body={actionsBodyTemplate}
          style={{ minWidth: '140px', textAlign: 'right' }}
        />
      </DataTable>
    </Card>
  );
}
