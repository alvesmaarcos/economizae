'use client';

import React from 'react';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import {
  Category,
  CreateTransactionInput,
  PAYMENT_METHOD_LABELS,
  PaymentCard,
  Transaction
} from '@/types/finance';
import {
  calculateCardInvoicesForMonth,
  formatBRL,
  formatDateBR,
  getDueStatus
} from '@/lib/finance-calculations';

interface BillsToPaySectionProps {
  transactions: Transaction[];
  categories: Category[];
  cards: PaymentCard[];
  competenceMonth: string;
  onTogglePaid: (tx: Transaction) => void;
  onPayCardInvoice: (cardId: string, cardName: string) => void;
  onEdit: (tx: Transaction) => void;
  onOpenNewBill: (preset?: Partial<CreateTransactionInput>) => void;
}

export default function BillsToPaySection({
  transactions,
  categories,
  cards,
  competenceMonth,
  onTogglePaid,
  onPayCardInvoice,
  onEdit,
  onOpenNewBill
}: BillsToPaySectionProps) {
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

  const cardInvoices = React.useMemo(
    () => calculateCardInvoicesForMonth(transactions, cards, competenceMonth),
    [transactions, cards, competenceMonth]
  );

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
    const hasDifferentPurchaseDate =
      tx.purchase_date && tx.purchase_date !== tx.due_date;

    return (
      <div className="flex flex-column gap-1">
        <span className="font-semibold text-sm">
          <i className="pi pi-calendar mr-1 text-color-secondary" />
          Vence: {formatDateBR(tx.due_date)}
        </span>
        {hasDifferentPurchaseDate && (
          <span className="text-xs text-color-secondary">
            Compra: {formatDateBR(tx.purchase_date)}
          </span>
        )}
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
    const txCard = tx.card_id ? cardMap.get(tx.card_id) : null;

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
            {txCard && (
              <span
                className="inline-flex align-items-center gap-1 px-2 py-1 border-round text-xs font-semibold text-white"
                style={{ backgroundColor: txCard.color }}
              >
                <i className="pi pi-credit-card text-xs" />
                {txCard.name}
              </span>
            )}
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
            Compromissos e faturas em aberto no mês ordenados por data de
            vencimento
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
          label="Compra no Cartão"
          icon="pi pi-credit-card"
          size="small"
          outlined
          onClick={() =>
            onOpenNewBill({
              type: 'expense',
              status: 'pending',
              payment_method: 'credit_card'
            })
          }
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
      {/* PAINEL DE RESUMO DAS FATURAS DE CARTÃO DO MÊS */}
      {cardInvoices.length > 0 && (
        <div className="mb-4 pb-3 border-bottom-1 surface-border">
          <div className="flex align-items-center justify-content-between mb-2">
            <span className="text-sm font-bold flex align-items-center gap-2">
              <i className="pi pi-credit-card text-primary" />
              Faturas de Cartão de Crédito neste Mês
            </span>
            <span className="text-xs text-color-secondary">
              Calculadas automaticamente pelo fechamento e vencimento de cada
              cartão
            </span>
          </div>

          <div className="grid">
            {cardInvoices.map((inv) => (
              <div
                key={inv.card.id}
                className="col-12 md:col-6 lg:col-4"
              >
                <div
                  className="p-3 border-round-xl border-1 h-full flex flex-column justify-content-between"
                  style={{
                    borderColor: `${inv.card.color}66`,
                    backgroundColor: `${inv.card.color}0D`
                  }}
                >
                  <div>
                    <div className="flex align-items-center justify-content-between gap-2 mb-2">
                      <div className="flex align-items-center gap-2">
                        <span
                          className="inline-flex align-items-center justify-content-center border-round-lg text-white shadow-1"
                          style={{
                            width: '2.2rem',
                            height: '2.2rem',
                            backgroundColor: inv.card.color
                          }}
                        >
                          <i className="pi pi-credit-card" />
                        </span>
                        <div>
                          <span className="font-bold text-sm block">
                            Fatura {inv.card.name}
                          </span>
                          <span className="text-xs text-color-secondary">
                            Vencimento:{' '}
                            <strong>{formatDateBR(inv.dueDateISO)}</strong>
                          </span>
                        </div>
                      </div>

                      <Tag
                        value={inv.dueStatus.label}
                        severity={inv.dueStatus.severity}
                        icon={`pi ${inv.dueStatus.icon}`}
                        className="text-xs"
                      />
                    </div>

                    <div className="flex justify-content-between align-items-baseline my-2">
                      <div>
                        <span className="text-xs text-color-secondary block">
                          A Pagar na Fatura
                        </span>
                        <span className="text-xl font-bold text-orange-500">
                          {formatBRL(inv.pendingAmount)}
                        </span>
                      </div>
                      <div className="text-right text-xs text-color-secondary">
                        <span>Total no mês: {formatBRL(inv.totalAmount)}</span>
                        <span className="block">
                          {inv.pendingCount} pendente(s) de {inv.totalCount}{' '}
                          compra(s)
                        </span>
                      </div>
                    </div>

                    {inv.limitUsagePercent !== null &&
                      inv.card.credit_limit && (
                        <div className="mb-3">
                          <div className="flex justify-content-between text-xs text-color-secondary mb-1">
                            <span>Uso do limite no mês</span>
                            <span>
                              {inv.limitUsagePercent}% de{' '}
                              {formatBRL(inv.card.credit_limit)}
                            </span>
                          </div>
                          <ProgressBar
                            value={inv.limitUsagePercent}
                            showValue={false}
                            color={inv.card.color}
                            style={{ height: '5px' }}
                          />
                        </div>
                      )}
                  </div>

                  <div className="flex align-items-center justify-content-between gap-2 pt-2 border-top-1 surface-border">
                    <Button
                      label="+ Compra"
                      icon="pi pi-plus"
                      size="small"
                      text
                      onClick={() =>
                        onOpenNewBill({
                          type: 'expense',
                          status: 'pending',
                          payment_method: 'credit_card',
                          card_id: inv.card.id
                        })
                      }
                    />
                    {inv.pendingCount > 0 ? (
                      <Button
                        label="Pagar Fatura Inteira"
                        icon="pi pi-check-circle"
                        severity="success"
                        size="small"
                        onClick={() =>
                          onPayCardInvoice(inv.card.id, inv.card.name)
                        }
                      />
                    ) : (
                      <Tag
                        value="Fatura Quitada"
                        severity="success"
                        icon="pi pi-check"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          header="Vencimento / Compra"
          body={dueStatusBodyTemplate}
          style={{ minWidth: '185px' }}
        />
        <Column
          header="Conta / Cartão / Categoria"
          body={descriptionBodyTemplate}
          style={{ minWidth: '260px' }}
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
