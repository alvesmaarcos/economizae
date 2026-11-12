'use client';

import React from 'react';
import { Card } from 'primereact/card';
import { Chart } from 'primereact/chart';
import { ProgressBar } from 'primereact/progressbar';
import {
  Category,
  MonthlySummary,
  Transaction
} from '@/types/finance';
import {
  calculateCategoryBreakdown,
  formatBRL
} from '@/lib/finance-calculations';

interface CategoryChartsProps {
  transactions: Transaction[];
  categories: Category[];
  summary: MonthlySummary;
  darkMode: boolean;
}

export default function CategoryCharts({
  transactions,
  categories,
  summary,
  darkMode
}: CategoryChartsProps) {
  const expenseBreakdown = React.useMemo(
    () => calculateCategoryBreakdown(transactions, categories, 'expense'),
    [transactions, categories]
  );

  const textColor = darkMode ? '#E5E7EB' : '#334155';
  const gridColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const doughnutData = React.useMemo(() => {
    return {
      labels: expenseBreakdown.map((item) => item.categoryName),
      datasets: [
        {
          data: expenseBreakdown.map((item) => item.totalAmount),
          backgroundColor: expenseBreakdown.map((item) => item.color),
          hoverOffset: 6,
          borderWidth: 2,
          borderColor: darkMode ? '#1F2937' : '#FFFFFF'
        }
      ]
    };
  }, [expenseBreakdown, darkMode]);

  const doughnutOptions = React.useMemo(() => {
    return {
      cutout: '65%',
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            color: textColor,
            usePointStyle: true,
            padding: 14
          }
        }
      }
    };
  }, [textColor]);

  const barData = React.useMemo(() => {
    return {
      labels: [
        'Entradas Recebidas',
        'Entradas a Receber',
        'Saídas Pagas',
        'Contas a Pagar'
      ],
      datasets: [
        {
          label: 'Valores no Mês (R$)',
          backgroundColor: ['#10B981', '#34D399', '#3B82F6', '#F97316'],
          borderRadius: 8,
          data: [
            summary.incomeReceived,
            summary.incomePending,
            summary.expensePaid,
            summary.billsToPayTotal
          ]
        }
      ]
    };
  }, [summary]);

  const barOptions = React.useMemo(() => {
    return {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            color: textColor,
            font: { size: 11 }
          },
          grid: {
            display: false
          }
        },
        y: {
          ticks: {
            color: textColor
          },
          grid: {
            color: gridColor
          }
        }
      }
    };
  }, [textColor, gridColor]);

  return (
    <div className="grid mb-4">
      {/* GRÁFICO 1: DESPESAS POR CATEGORIA */}
      <div className="col-12 lg:col-6">
        <Card className="h-full shadow-1 border-round-xl">
          <div className="flex align-items-center justify-content-between mb-3">
            <div className="flex align-items-center gap-2">
              <i className="pi pi-chart-pie text-primary text-xl" />
              <div>
                <span className="font-bold text-lg">
                  Saídas e Contas por Categoria
                </span>
                <p className="m-0 text-xs text-color-secondary">
                  Soma de saídas pagas + contas a pagar do mês
                </p>
              </div>
            </div>
          </div>

          {expenseBreakdown.length === 0 ? (
            <div className="text-center py-5 text-color-secondary">
              <i className="pi pi-inbox text-3xl mb-2 block" />
              Nenhuma saída ou conta a pagar registrada neste mês.
            </div>
          ) : (
            <div className="grid align-items-center">
              <div className="col-12 md:col-6">
                <div style={{ height: '230px' }}>
                  <Chart
                    type="doughnut"
                    data={doughnutData}
                    options={doughnutOptions}
                    className="w-full h-full"
                  />
                </div>
              </div>
              <div className="col-12 md:col-6">
                <div className="flex flex-column gap-3 max-h-15rem overflow-y-auto pr-1">
                  {expenseBreakdown.map((item) => (
                    <div key={item.categoryId}>
                      <div className="flex justify-content-between align-items-center text-xs mb-1">
                        <span className="font-semibold flex align-items-center gap-2">
                          <i
                            className={`pi ${item.icon}`}
                            style={{ color: item.color }}
                          />
                          {item.categoryName}
                        </span>
                        <span>
                          <strong>{formatBRL(item.totalAmount)}</strong> (
                          {item.percentage}%)
                        </span>
                      </div>
                      <ProgressBar
                        value={item.percentage}
                        showValue={false}
                        color={item.color}
                        style={{ height: '6px' }}
                      />
                      <div className="flex justify-content-between text-xs text-color-secondary mt-1">
                        <span>Pago: {formatBRL(item.paidAmount)}</span>
                        <span>Pendente: {formatBRL(item.pendingAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* GRÁFICO 2: BALANÇO MENSAL (ENTRADAS VS SAÍDAS VS CONTAS A PAGAR) */}
      <div className="col-12 lg:col-6">
        <Card className="h-full shadow-1 border-round-xl">
          <div className="flex align-items-center justify-content-between mb-3">
            <div className="flex align-items-center gap-2">
              <i className="pi pi-chart-bar text-primary text-xl" />
              <div>
                <span className="font-bold text-lg">
                  Comparativo do Fluxo no Mês
                </span>
                <p className="m-0 text-xs text-color-secondary">
                  Entradas (Recebidas/A receber) vs. Saídas Pagas e Contas a Pagar
                </p>
              </div>
            </div>
          </div>

          <div style={{ height: '230px' }}>
            <Chart
              type="bar"
              data={barData}
              options={barOptions}
              className="w-full h-full"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
