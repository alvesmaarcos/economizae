'use client';

import React from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import { MonthlySummary } from '@/types/finance';
import { formatBRL, formatDateBR } from '@/lib/finance-calculations';

interface SummaryCardsProps {
  summary: MonthlySummary;
  balanceDate: string | null;
  onEditBalance: () => void;
  onFilterSelect: (filter: 'all' | 'income' | 'expense_paid' | 'bills_to_pay') => void;
}

export default function SummaryCards({
  summary,
  balanceDate,
  onEditBalance,
  onFilterSelect
}: SummaryCardsProps) {
  const incomeProgress =
    summary.incomeTotal > 0
      ? Math.round((summary.incomeReceived / summary.incomeTotal) * 100)
      : 0;

  const expensePaidProgress =
    summary.expenseTotal > 0
      ? Math.round((summary.expensePaid / summary.expenseTotal) * 100)
      : 0;

  return (
    <div className="grid mb-4">
      {/* 1. ENTRADAS NO MÊS */}
      <div className="col-12 md:col-6 xl:col-3">
        <Card
          className="h-full shadow-1 border-round-xl cursor-pointer hover:surface-hover transition-duration-150 summary-card-income"
          onClick={() => onFilterSelect('income')}
        >
          <div className="flex justify-content-between align-items-start mb-3">
            <div>
              <span className="block text-sm font-medium text-color-secondary mb-1">
                Entradas no Mês
              </span>
              <div className="text-2xl font-bold text-green-500">
                {formatBRL(summary.incomeTotal)}
              </div>
            </div>
            <div
              className="flex align-items-center justify-content-center border-round-lg"
              style={{
                width: '2.75rem',
                height: '2.75rem',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981'
              }}
            >
              <i className="pi pi-arrow-up-right text-xl" />
            </div>
          </div>

          <ProgressBar
            value={incomeProgress}
            showValue={false}
            style={{ height: '6px' }}
            color="#10B981"
            className="mb-3 border-round"
          />

          <div className="flex justify-content-between align-items-center text-xs text-color-secondary">
            <span>
              <i className="pi pi-check-circle text-green-500 mr-1" />
              Recebido: <strong className="text-color">{formatBRL(summary.incomeReceived)}</strong>
            </span>
            <span>
              A receber: <strong className="text-color">{formatBRL(summary.incomePending)}</strong>
            </span>
          </div>
        </Card>
      </div>

      {/* 2. SAÍDAS REALIZADAS (PAGAS) */}
      <div className="col-12 md:col-6 xl:col-3">
        <Card
          className="h-full shadow-1 border-round-xl cursor-pointer hover:surface-hover transition-duration-150 summary-card-paid"
          onClick={() => onFilterSelect('expense_paid')}
        >
          <div className="flex justify-content-between align-items-start mb-3">
            <div>
              <span className="block text-sm font-medium text-color-secondary mb-1">
                Saídas Pagas
              </span>
              <div className="text-2xl font-bold text-blue-500">
                {formatBRL(summary.expensePaid)}
              </div>
            </div>
            <div
              className="flex align-items-center justify-content-center border-round-lg"
              style={{
                width: '2.75rem',
                height: '2.75rem',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: '#3B82F6'
              }}
            >
              <i className="pi pi-check-square text-xl" />
            </div>
          </div>

          <ProgressBar
            value={expensePaidProgress}
            showValue={false}
            style={{ height: '6px' }}
            color="#3B82F6"
            className="mb-3 border-round"
          />

          <div className="flex justify-content-between align-items-center text-xs text-color-secondary">
            <span>
              <i className="pi pi-list text-blue-500 mr-1" />
              <strong>{summary.expensePaidCount}</strong> saída(s) quitada(s)
            </span>
            <span>
              Total saídas: <strong className="text-color">{formatBRL(summary.expenseTotal)}</strong>
            </span>
          </div>
        </Card>
      </div>

      {/* 3. CONTAS A PAGAR (SAÍDAS PENDENTES) */}
      <div className="col-12 md:col-6 xl:col-3">
        <Card
          className="h-full shadow-1 border-round-xl cursor-pointer hover:surface-hover transition-duration-150 summary-card-pending"
          onClick={() => onFilterSelect('bills_to_pay')}
        >
          <div className="flex justify-content-between align-items-start mb-3">
            <div>
              <span className="block text-sm font-medium text-color-secondary mb-1">
                Contas a Pagar (Pendentes)
              </span>
              <div className="text-2xl font-bold text-orange-500">
                {formatBRL(summary.billsToPayTotal)}
              </div>
            </div>
            <div
              className="flex align-items-center justify-content-center border-round-lg"
              style={{
                width: '2.75rem',
                height: '2.75rem',
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                color: '#F97316'
              }}
            >
              <i className="pi pi-clock text-xl" />
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            {summary.overdueBillsCount > 0 && (
              <Tag
                severity="danger"
                icon="pi pi-exclamation-triangle"
                value={`${summary.overdueBillsCount} atrasada(s): ${formatBRL(
                  summary.overdueBillsAmount
                )}`}
              />
            )}
            {summary.dueTodayCount > 0 && (
              <Tag
                severity="warning"
                icon="pi pi-bell"
                value={`${summary.dueTodayCount} vence(m) hoje`}
              />
            )}
            {summary.overdueBillsCount === 0 &&
              summary.dueTodayCount === 0 &&
              summary.billsToPayCount > 0 && (
                <Tag
                  severity="info"
                  icon="pi pi-calendar"
                  value={`${summary.billsToPayCount} conta(s) no prazo`}
                />
              )}
            {summary.billsToPayCount === 0 && (
              <Tag
                severity="success"
                icon="pi pi-check"
                value="Tudo em dia neste mês!"
              />
            )}
          </div>

          <div className="flex justify-content-between align-items-center text-xs text-color-secondary mt-2">
            <span>
              Em aberto: <strong className="text-color">{summary.billsToPayCount} conta(s)</strong>
            </span>
            {summary.dueSoonCount > 0 && (
              <span className="text-orange-500 font-medium">
                {summary.dueSoonCount} vence(m) em até 3 dias
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* 4. SALDO DO MÊS (ATUAL EM CAIXA + PREVISTO) */}
      <div className="col-12 md:col-6 xl:col-3">
        <Card
          className="h-full shadow-1 border-round-xl summary-card-balance"
        >
          <div className="flex justify-content-between align-items-start mb-2">
            <div>
              <span className="block text-sm font-medium text-color-secondary mb-1">
                Saldo Real em Caixa
              </span>
              <div
                className={`text-2xl font-bold ${
                  summary.currentBalance >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {balanceDate ? formatBRL(summary.currentBalance) : '—'}
              </div>
            </div>
            <div
              className="flex align-items-center justify-content-center border-round-lg"
              style={{
                width: '2.75rem',
                height: '2.75rem',
                backgroundColor:
                  summary.currentBalance >= 0
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                color: summary.currentBalance >= 0 ? '#10B981' : '#EF4444'
              }}
            >
              <i className="pi pi-wallet text-xl" />
            </div>
          </div>

          <div className="flex flex-wrap align-items-center justify-content-between gap-1">
            {balanceDate && (
              <span className="text-xs text-color-secondary">Até {formatDateBR(balanceDate)}</span>
            )}
            <Button
              type="button"
              label="Editar saldo real"
              icon="pi pi-pencil"
              text
              size="small"
              onClick={onEditBalance}
            />
          </div>

          <div className="surface-ground p-2 border-round-lg border-1 surface-border mt-2">
            <div className="flex justify-content-between align-items-center text-xs">
              <span className="text-color-secondary">
                <i className="pi pi-chart-line mr-1" />
                Saldo Previsto no Fim do Mês:
              </span>
              <strong
                className={
                  summary.projectedBalance >= 0 ? 'text-green-500' : 'text-red-500'
                }
              >
                {balanceDate ? formatBRL(summary.projectedBalance) : '—'}
              </strong>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
