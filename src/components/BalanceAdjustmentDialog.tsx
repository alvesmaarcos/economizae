'use client';

import React from 'react';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Dialog } from 'primereact/dialog';
import { InputNumber } from 'primereact/inputnumber';
import { Message } from 'primereact/message';
import { getBalanceToday, parseISODateLocal, toISODateString } from '@/lib/finance-calculations';

interface BalanceAdjustmentDialogProps {
  referenceDate: string;
  onSave: (date: string, amount: number) => Promise<void>;
  onHide: () => void;
}

export default function BalanceAdjustmentDialog({
  referenceDate,
  onSave,
  onHide
}: BalanceAdjustmentDialogProps) {
  const [date, setDate] = React.useState(() => parseISODateLocal(referenceDate));
  const [amount, setAmount] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const today = getBalanceToday();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const dateISO = toISODateString(date);
    if (dateISO > today || amount === null || !Number.isFinite(amount)) {
      setError('Informe um saldo e selecione uma data até hoje.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave(dateISO, amount);
      onHide();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o saldo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      header="Editar saldo real"
      visible
      modal
      draggable={false}
      closable={!saving}
      closeOnEscape={!saving}
      onHide={onHide}
      style={{ width: 'min(92vw, 27rem)' }}
    >
      <form onSubmit={handleSubmit} className="flex flex-column gap-3">
        <p className="m-0 text-sm text-color-secondary">
          Informe quanto havia em caixa ao fim da data escolhida. O valor já inclui
          os recebimentos e pagamentos feitos até esse dia. Salvar na mesma data
          substitui o saldo informado anteriormente.
        </p>
        <div>
          <label htmlFor="balance-date" className="block mb-1">Data do saldo</label>
          <Calendar
            inputId="balance-date"
            value={date}
            onChange={(event) => {
              if (event.value instanceof Date) setDate(event.value);
            }}
            maxDate={parseISODateLocal(today)}
            dateFormat="dd/mm/yy"
            locale="pt-BR"
            readOnlyInput
            showIcon
            disabled={saving}
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="balance-amount" className="block mb-1">Saldo em reais</label>
          <InputNumber
            inputId="balance-amount"
            value={amount}
            onValueChange={(event) => setAmount(event.value ?? null)}
            mode="currency"
            currency="BRL"
            locale="pt-BR"
            min={-999999999999.99}
            max={999999999999.99}
            disabled={saving}
            required
            className="w-full"
            inputClassName="w-full"
          />
        </div>
        {error && <Message severity="error" text={error} />}
        <div className="flex justify-content-end gap-2">
          <Button type="button" label="Cancelar" text onClick={onHide} disabled={saving} />
          <Button type="submit" label="Salvar saldo" loading={saving} />
        </div>
      </form>
    </Dialog>
  );
}
