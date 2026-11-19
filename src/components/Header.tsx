'use client';

import React from 'react';
import { Toolbar } from 'primereact/toolbar';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Tag } from 'primereact/tag';
import '@/lib/primereact-locale';
import { CreateTransactionInput } from '@/types/finance';

interface HeaderProps {
  selectedMonthDate: Date;
  onMonthChange: (newDate: Date) => void;
  onOpenNewTransaction: (preset?: Partial<CreateTransactionInput>) => void;
  onOpenCards: () => void;
  onOpenCategories: () => void;
  onOpenCloudModal: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  storageMode: 'supabase' | 'local';
  userEmail: string | null;
}

export default function Header({
  selectedMonthDate,
  onMonthChange,
  onOpenNewTransaction,
  onOpenCards,
  onOpenCategories,
  onOpenCloudModal,
  darkMode,
  onToggleDarkMode,
  storageMode,
  userEmail
}: HeaderProps) {
  const handlePrevMonth = () => {
    const prev = new Date(
      selectedMonthDate.getFullYear(),
      selectedMonthDate.getMonth() - 1,
      1,
      12,
      0,
      0
    );
    onMonthChange(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(
      selectedMonthDate.getFullYear(),
      selectedMonthDate.getMonth() + 1,
      1,
      12,
      0,
      0
    );
    onMonthChange(next);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0));
  };

  const startContent = (
    <div className="flex align-items-center gap-3">
      <div
        className="flex align-items-center justify-content-center border-round-xl shadow-2"
        style={{
          width: '2.75rem',
          height: '2.75rem',
          background: 'linear-gradient(135deg, #2563EB 0%, #10B981 100%)',
          color: '#ffffff'
        }}
      >
        <i className="pi pi-wallet text-xl" />
      </div>
      <div>
        <div className="flex align-items-center gap-2">
          <span className="text-xl font-bold tracking-tight">Economizaê</span>
          <Tag
            value={storageMode === 'supabase' ? 'Nuvem Supabase' : 'Modo Local'}
            icon={storageMode === 'supabase' ? 'pi pi-cloud' : 'pi pi-database'}
            severity={storageMode === 'supabase' ? 'success' : 'info'}
            className="cursor-pointer text-xs"
            onClick={onOpenCloudModal}
          />
        </div>
        <p className="m-0 text-xs text-color-secondary">
          {userEmail
            ? `Conectado como ${userEmail}`
            : 'Controle de Entradas, Saídas, Cartões e Contas a Pagar'}
        </p>
      </div>
    </div>
  );

  const centerContent = (
    <div className="flex align-items-center gap-2 surface-ground p-1 border-round-lg border-1 surface-border">
      <Button
        icon="pi pi-chevron-left"
        rounded
        text
        size="small"
        onClick={handlePrevMonth}
        aria-label="Mês anterior"
        tooltip="Mês anterior"
        tooltipOptions={{ position: 'bottom' }}
      />
      <Calendar
        value={selectedMonthDate}
        onChange={(e) => {
          if (e.value instanceof Date) {
            onMonthChange(
              new Date(
                e.value.getFullYear(),
                e.value.getMonth(),
                1,
                12,
                0,
                0
              )
            );
          }
        }}
        view="month"
        dateFormat="MM yy"
        locale="pt-BR"
        showIcon
        inputClassName="text-center font-semibold border-none surface-ground w-11rem cursor-pointer"
        className="month-picker-calendar"
      />
      <Button
        icon="pi pi-chevron-right"
        rounded
        text
        size="small"
        onClick={handleNextMonth}
        aria-label="Próximo mês"
        tooltip="Próximo mês"
        tooltipOptions={{ position: 'bottom' }}
      />
      <Button
        label="Hoje"
        icon="pi pi-calendar"
        size="small"
        text
        onClick={handleCurrentMonth}
        className="text-xs font-semibold"
      />
    </div>
  );

  const endContent = (
    <div className="flex align-items-center flex-wrap gap-2">
      <Button
        icon="pi pi-credit-card"
        label="Meus Cartões"
        outlined
        size="small"
        onClick={onOpenCards}
      />
      <Button
        icon="pi pi-tags"
        label="Categorias"
        outlined
        size="small"
        onClick={onOpenCategories}
      />
      <Button
        icon={storageMode === 'supabase' ? 'pi pi-cloud-upload' : 'pi pi-sync'}
        label="Dados / Nuvem"
        outlined
        size="small"
        severity="secondary"
        onClick={onOpenCloudModal}
      />
      <Button
        icon={darkMode ? 'pi pi-sun' : 'pi pi-moon'}
        rounded
        outlined
        size="small"
        severity="secondary"
        onClick={onToggleDarkMode}
        aria-label="Alternar tema"
        tooltip={darkMode ? 'Modo Claro' : 'Modo Escuro'}
        tooltipOptions={{ position: 'bottom' }}
      />
      <Button
        icon="pi pi-clock"
        label="+ Conta a Pagar"
        severity="warning"
        size="small"
        onClick={() =>
          onOpenNewTransaction({ type: 'expense', status: 'pending' })
        }
      />
      <Button
        icon="pi pi-plus"
        label="Novo Lançamento"
        severity="success"
        size="small"
        onClick={() => onOpenNewTransaction()}
      />
    </div>
  );

  return (
    <header className="mb-4">
      <Toolbar
        start={startContent}
        center={centerContent}
        end={endContent}
        className="border-round-xl shadow-1 surface-card px-3 py-2"
      />
    </header>
  );
}
