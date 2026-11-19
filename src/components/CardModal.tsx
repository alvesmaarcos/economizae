'use client';

import React from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { SelectButton } from 'primereact/selectbutton';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import {
  CARD_MODALITY_LABELS,
  CardModality,
  PaymentCard
} from '@/types/finance';
import { formatBRL } from '@/lib/finance-calculations';

interface CardModalProps {
  visible: boolean;
  onHide: () => void;
  cards: PaymentCard[];
  onCreateCard: (
    card: Omit<PaymentCard, 'id' | 'created_at' | 'user_id'>
  ) => Promise<void>;
  onUpdateCard: (
    cardId: string,
    updates: Partial<Omit<PaymentCard, 'id' | 'created_at' | 'user_id'>>
  ) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
}

const CARD_COLOR_SWATCHES = [
  '#8B5CF6', // Roxo (ex: Nubank)
  '#F97316', // Laranja (ex: Itaú / Inter)
  '#111827', // Preto / Carbon (ex: C6 Black / Ultrablue)
  '#EF4444', // Vermelho (ex: Santander / Bradesco)
  '#EAB308', // Amarelo (ex: Banco do Brasil / Will)
  '#2563EB', // Azul (ex: Caixa / BTG)
  '#10B981', // Verde (ex: PicPay / Sicredi)
  '#06B6D4', // Ciano
  '#EC4899'  // Rosa
];

const MODALITY_OPTIONS: { label: string; value: CardModality }[] = [
  { label: 'Crédito e Débito', value: 'both' },
  { label: 'Só Crédito', value: 'credit' },
  { label: 'Só Débito', value: 'debit' }
];

export default function CardModal({
  visible,
  onHide,
  cards,
  onCreateCard,
  onUpdateCard,
  onDeleteCard
}: CardModalProps) {
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState('#8B5CF6');
  const [modality, setModality] = React.useState<CardModality>('both');
  const [closingDay, setClosingDay] = React.useState<number>(3);
  const [dueDay, setDueDay] = React.useState<number>(10);
  const [creditLimit, setCreditLimit] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const supportsCredit = modality === 'both' || modality === 'credit';

  const resetForm = () => {
    setEditingCardId(null);
    setName('');
    setColor('#8B5CF6');
    setModality('both');
    setClosingDay(3);
    setDueDay(10);
    setCreditLimit(null);
    setErrorMsg(null);
  };

  const handleStartEdit = (card: PaymentCard) => {
    setEditingCardId(card.id);
    setName(card.name);
    setColor(card.color);
    setModality(card.modality);
    setClosingDay(card.closing_day || 3);
    setDueDay(card.due_day || 10);
    setCreditLimit(card.credit_limit);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome ou apelido do cartão.');
      return;
    }

    if (supportsCredit && (!closingDay || !dueDay)) {
      setErrorMsg(
        'Informe o dia de fechamento e o dia de vencimento da fatura.'
      );
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        name: name.trim(),
        color,
        modality,
        closing_day: supportsCredit ? closingDay : null,
        due_day: supportsCredit ? dueDay : null,
        credit_limit: supportsCredit ? creditLimit : null
      };

      if (editingCardId) {
        await onUpdateCard(editingCardId, payload);
      } else {
        await onCreateCard(payload);
      }
      resetForm();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao salvar o cartão.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      header={
        <div className="flex align-items-center gap-2">
          <i className="pi pi-credit-card text-primary text-xl" />
          <span>Meus Cartões (Crédito & Débito)</span>
        </div>
      }
      visible={visible}
      onHide={() => {
        resetForm();
        onHide();
      }}
      style={{ width: '95vw', maxWidth: '620px' }}
      modal
      draggable={false}
    >
      <form
        onSubmit={handleSubmit}
        className="surface-ground p-3 border-round-lg border-1 surface-border mb-4"
      >
        <div className="flex align-items-center justify-content-between mb-2">
          <span className="text-xs font-bold text-color-secondary">
            {editingCardId
              ? 'EDITAR CARTÃO SELECIONADO'
              : 'CADASTRAR NOVO CARTÃO'}
          </span>
          {editingCardId && (
            <Button
              type="button"
              label="Cancelar Edição"
              icon="pi pi-times"
              text
              size="small"
              onClick={resetForm}
            />
          )}
        </div>

        {errorMsg && (
          <div className="p-2 mb-3 border-round bg-red-100 text-red-700 text-xs flex align-items-center gap-2">
            <i className="pi pi-exclamation-circle" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid">
          <div className="col-12 md:col-6">
            <label className="block text-xs font-medium mb-1">
              Nome / Apelido do Cartão *
            </label>
            <InputText
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nubank, Itaú Click, Inter..."
              className="w-full p-inputtext-sm"
            />
          </div>

          <div className="col-12 md:col-6">
            <label className="block text-xs font-medium mb-1">
              Modalidade *
            </label>
            <SelectButton
              value={modality}
              options={MODALITY_OPTIONS}
              onChange={(e) => {
                if (e.value) setModality(e.value);
              }}
              className="w-full p-button-sm"
            />
          </div>

          {supportsCredit && (
            <>
              <div className="col-6 md:col-4">
                <label className="block text-xs font-medium mb-1">
                  Dia do Fechamento *
                </label>
                <InputNumber
                  value={closingDay}
                  onValueChange={(e) => setClosingDay(e.value || 1)}
                  min={1}
                  max={31}
                  showButtons
                  prefix="Dia "
                  className="w-full p-inputtext-sm"
                  inputClassName="w-full"
                />
              </div>

              <div className="col-6 md:col-4">
                <label className="block text-xs font-medium mb-1">
                  Dia do Vencimento *
                </label>
                <InputNumber
                  value={dueDay}
                  onValueChange={(e) => setDueDay(e.value || 10)}
                  min={1}
                  max={31}
                  showButtons
                  prefix="Dia "
                  className="w-full p-inputtext-sm"
                  inputClassName="w-full"
                />
              </div>

              <div className="col-12 md:col-4">
                <label className="block text-xs font-medium mb-1">
                  Limite (opcional)
                </label>
                <InputNumber
                  value={creditLimit}
                  onValueChange={(e) => setCreditLimit(e.value ?? null)}
                  mode="currency"
                  currency="BRL"
                  locale="pt-BR"
                  placeholder="R$ 0,00"
                  className="w-full p-inputtext-sm"
                  inputClassName="w-full"
                />
              </div>
            </>
          )}

          <div className="col-12">
            <label className="block text-xs font-medium mb-1">
              Cor de Identificação
            </label>
            <div className="flex align-items-center gap-2 flex-wrap">
              {CARD_COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Cor ${swatch}`}
                  className="border-circle cursor-pointer border-none"
                  style={{
                    width: '1.6rem',
                    height: '1.6rem',
                    backgroundColor: swatch,
                    outline:
                      color === swatch ? '2px solid var(--text-color)' : 'none',
                    outlineOffset: '2px'
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-content-between align-items-center mt-3 pt-2 border-top-1 surface-border">
          <span className="text-xs text-color-secondary">
            {supportsCredit
              ? `Compras antes do dia ${closingDay} vencem no dia ${dueDay} (${
                  dueDay > closingDay ? 'mesmo mês' : 'mês seguinte'
                }).`
              : 'Cartão apenas Débito: compras saem na própria data da compra.'}
          </span>
          <Button
            type="submit"
            label={editingCardId ? 'Salvar Cartão' : 'Adicionar Cartão'}
            icon={editingCardId ? 'pi pi-check' : 'pi pi-plus'}
            size="small"
            severity="success"
            loading={saving}
            disabled={!name.trim()}
          />
        </div>
      </form>

      <div className="flex flex-column gap-2 max-h-20rem overflow-y-auto pr-1">
        {cards.length === 0 ? (
          <div className="text-center py-4 text-color-secondary text-sm">
            Nenhum cartão cadastrado ainda.
          </div>
        ) : (
          cards.map((card) => (
            <div
              key={card.id}
              className="flex align-items-center justify-content-between p-3 border-round-lg border-1 surface-border"
            >
              <div className="flex align-items-center gap-3">
                <span
                  className="inline-flex align-items-center justify-content-center border-round-lg text-white shadow-1"
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    backgroundColor: card.color
                  }}
                >
                  <i className="pi pi-credit-card text-lg" />
                </span>
                <div>
                  <div className="flex align-items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{card.name}</span>
                    <Tag
                      value={CARD_MODALITY_LABELS[card.modality]}
                      severity="info"
                      className="text-xs"
                    />
                  </div>
                  <div className="text-xs text-color-secondary mt-1 flex flex-wrap gap-2">
                    {(card.modality === 'both' || card.modality === 'credit') &&
                      card.closing_day &&
                      card.due_day && (
                        <span>
                          <i className="pi pi-calendar mr-1 text-xs" />
                          Fecha dia <strong>{card.closing_day}</strong> • Vence
                          dia <strong>{card.due_day}</strong>
                        </span>
                      )}
                    {card.credit_limit && (
                      <span>• Limite: {formatBRL(card.credit_limit)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex align-items-center gap-1">
                <Button
                  icon="pi pi-pencil"
                  rounded
                  text
                  severity="info"
                  size="small"
                  onClick={() => handleStartEdit(card)}
                  tooltip="Editar cartão"
                  tooltipOptions={{ position: 'top' }}
                />
                <Button
                  icon="pi pi-trash"
                  rounded
                  text
                  severity="danger"
                  size="small"
                  onClick={() => onDeleteCard(card.id)}
                  tooltip="Excluir cartão"
                  tooltipOptions={{ position: 'top' }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}
