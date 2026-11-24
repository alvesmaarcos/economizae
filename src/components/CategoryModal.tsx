'use client';

import React from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import {
  Category,
  PRIME_ICON_OPTIONS,
  TransactionType
} from '@/types/finance';

interface CategoryModalProps {
  visible: boolean;
  onHide: () => void;
  categories: Category[];
  onCreateCategory: (
    cat: Omit<Category, 'id' | 'created_at' | 'user_id'>
  ) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

const COLOR_SWATCHES = [
  '#10B981',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#14B8A6',
  '#06B6D4'
];

export default function CategoryModal({
  visible,
  onHide,
  categories,
  onCreateCategory,
  onDeleteCategory
}: CategoryModalProps) {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<TransactionType>('expense');
  const [icon, setIcon] = React.useState<string>('pi-tag');
  const [color, setColor] = React.useState<string>('#3B82F6');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onCreateCategory({
        name: name.trim(),
        type,
        icon,
        color
      });
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a categoria.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      header={
        <div className="flex align-items-center gap-2">
          <i className="pi pi-tags text-primary text-xl" />
          <span>Gerenciar Categorias</span>
        </div>
      }
      visible={visible}
      onHide={onHide}
      style={{ width: '95vw', maxWidth: '560px' }}
      modal
      draggable={false}
    >
      {error && <Message severity="error" text={error} className="w-full mb-3" />}
      <form
        onSubmit={handleCreate}
        className="surface-ground p-3 border-round-lg border-1 surface-border mb-4"
      >
        <span className="block text-xs font-bold text-color-secondary mb-2">
          NOVA CATEGORIA PERSONALIZADA
        </span>

        <div className="grid">
          <div className="col-12 md:col-7">
            <label className="block text-xs font-medium mb-1">
              Nome da Categoria
            </label>
            <InputText
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Pets, Assinaturas, Bônus..."
              className="w-full p-inputtext-sm"
            />
          </div>

          <div className="col-12 md:col-5">
            <label className="block text-xs font-medium mb-1">Tipo</label>
            <SelectButton
              value={type}
              options={[
                { label: 'Saída', value: 'expense' },
                { label: 'Entrada', value: 'income' }
              ]}
              onChange={(e) => {
                if (e.value) setType(e.value);
              }}
              className="w-full p-button-sm"
            />
          </div>

          <div className="col-12 md:col-6">
            <label className="block text-xs font-medium mb-1">
              Ícone (PrimeIcons)
            </label>
            <Dropdown
              value={icon}
              options={PRIME_ICON_OPTIONS}
              onChange={(e) => setIcon(e.value)}
              className="w-full p-inputtext-sm"
              itemTemplate={(opt) => (
                <div className="flex align-items-center gap-2">
                  <i className={`pi ${opt.value}`} />
                  <span>{opt.label}</span>
                </div>
              )}
              valueTemplate={(opt) =>
                opt ? (
                  <div className="flex align-items-center gap-2">
                    <i className={`pi ${opt.value}`} />
                    <span>{opt.label}</span>
                  </div>
                ) : (
                  <span>Ícone</span>
                )
              }
            />
          </div>

          <div className="col-12 md:col-6">
            <label className="block text-xs font-medium mb-1">Cor</label>
            <div className="flex align-items-center gap-1 flex-wrap pt-1">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Cor ${swatch}`}
                  className="border-circle cursor-pointer border-none transition-transform"
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
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

        <div className="flex justify-content-end mt-3">
          <Button
            type="submit"
            label="Adicionar Categoria"
            icon="pi pi-plus"
            size="small"
            severity="success"
            loading={saving}
            disabled={!name.trim()}
          />
        </div>
      </form>

      <div className="flex flex-column gap-2 max-h-20rem overflow-y-auto pr-1">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex align-items-center justify-content-between p-2 border-round-lg border-1 surface-border"
          >
            <div className="flex align-items-center gap-2">
              <span
                className="inline-flex align-items-center justify-content-center border-round"
                style={{
                  width: '2rem',
                  height: '2rem',
                  backgroundColor: `${cat.color}22`,
                  color: cat.color
                }}
              >
                <i className={`pi ${cat.icon}`} />
              </span>
              <div>
                <span className="font-semibold text-sm block">{cat.name}</span>
                <Tag
                  value={cat.type === 'income' ? 'Entrada' : 'Saída'}
                  severity={cat.type === 'income' ? 'success' : 'warning'}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <Button
              icon="pi pi-trash"
              rounded
              text
              severity="danger"
              size="small"
              onClick={() => onDeleteCategory(cat.id)}
              aria-label={`Excluir ${cat.name}`}
            />
          </div>
        ))}
      </div>
    </Dialog>
  );
}
