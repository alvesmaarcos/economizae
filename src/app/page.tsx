'use client';

import React from 'react';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import Header from '@/components/Header';
import SummaryCards from '@/components/SummaryCards';
import BillsToPaySection from '@/components/BillsToPaySection';
import CategoryCharts from '@/components/CategoryCharts';
import TransactionList, {
  TransactionTabFilter
} from '@/components/TransactionList';
import TransactionModal from '@/components/TransactionModal';
import CategoryModal from '@/components/CategoryModal';
import CardModal from '@/components/CardModal';
import AuthModal from '@/components/AuthModal';
import {
  Category,
  CreateTransactionInput,
  DEFAULT_CARDS,
  DEFAULT_CATEGORIES,
  PaymentCard,
  Transaction
} from '@/types/finance';
import {
  calculateMonthlySummary,
  formatBRL,
  formatCompetenceMonthBR,
  formatDateBR,
  getCompetenceMonth
} from '@/lib/finance-calculations';
import { setupPrimeReactLocale } from '@/lib/primereact-locale';
import { financeRepository } from '@/services/finance-repository';

export default function HomePage() {
  const toastRef = React.useRef<Toast>(null);

  const [selectedMonthDate, setSelectedMonthDate] = React.useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
  });

  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [categories, setCategories] =
    React.useState<Category[]>(DEFAULT_CATEGORIES);
  const [cards, setCards] = React.useState<PaymentCard[]>(DEFAULT_CARDS);
  const [activeTab, setActiveTab] =
    React.useState<TransactionTabFilter>('all');
  const [darkMode, setDarkMode] = React.useState<boolean>(false);
  const [storageMode, setStorageMode] = React.useState<'supabase' | 'local'>(
    'local'
  );
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  // Modais
  const [txModalVisible, setTxModalVisible] = React.useState(false);
  const [editingTx, setEditingTx] = React.useState<Transaction | null>(null);
  const [txPreset, setTxPreset] = React.useState<
    Partial<CreateTransactionInput> | undefined
  >(undefined);
  const [catModalVisible, setCatModalVisible] = React.useState(false);
  const [cardModalVisible, setCardModalVisible] = React.useState(false);
  const [authModalVisible, setAuthModalVisible] = React.useState(false);
  const [deletingTx, setDeletingTx] = React.useState<Transaction | null>(null);

  React.useEffect(() => {
    setupPrimeReactLocale();
    const savedTheme = window.localStorage.getItem('economizae_dark_mode');
    if (savedTheme === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark-theme');
    }
  }, []);

  const competenceMonth = React.useMemo(
    () => getCompetenceMonth(selectedMonthDate),
    [selectedMonthDate]
  );

  const loadData = React.useCallback(async () => {
    try {
      const [statusInfo, cats, loadedCards, txs] = await Promise.all([
        financeRepository.getActiveStorageMode(),
        financeRepository.listCategories(),
        financeRepository.listCards(),
        financeRepository.listTransactionsByMonth(competenceMonth)
      ]);
      setStorageMode(statusInfo.mode);
      setUserEmail(statusInfo.userEmail);
      setCategories(cats);
      setCards(loadedCards);
      setTransactions(txs);
    } catch (err) {
      toastRef.current?.show({
        severity: 'error',
        summary: 'Erro ao carregar dados',
        detail:
          err instanceof Error ? err.message : 'Falha inesperada na leitura.',
        life: 4000
      });
    }
  }, [competenceMonth]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = React.useMemo(
    () => calculateMonthlySummary(transactions),
    [transactions]
  );

  const handleToggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    window.localStorage.setItem('economizae_dark_mode', String(next));
    if (next) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
  };

  const handleOpenNewTransaction = (
    preset?: Partial<CreateTransactionInput>
  ) => {
    setEditingTx(null);
    setTxPreset(preset);
    setTxModalVisible(true);
  };

  const handleOpenEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
    setTxPreset(undefined);
    setTxModalVisible(true);
  };

  const handleSaveCreate = async (
    input: CreateTransactionInput,
    firstInvoiceMonth?: string
  ) => {
    const created = await financeRepository.createTransactions(input, cards);
    await loadData();

    const firstTx = created[0];
    if (
      firstInvoiceMonth &&
      firstInvoiceMonth !== competenceMonth &&
      firstTx
    ) {
      toastRef.current?.show({
        severity: 'info',
        summary: `Alocado na Fatura de ${formatCompetenceMonthBR(firstInvoiceMonth)}`,
        detail: `Pelo vencimento do cartão, você pagará "${input.description}" em ${formatDateBR(firstTx.due_date)}.`,
        life: 4800
      });
    } else {
      toastRef.current?.show({
        severity: 'success',
        summary: 'Lançamento Registrado',
        detail:
          created.length > 1
            ? `${created.length} lançamentos gerados com sucesso!`
            : `"${input.description}" (${formatBRL(input.amount)}) adicionado!`,
        life: 3200
      });
    }
  };

  const handleSaveUpdate = async (
    id: string,
    updates: Partial<Transaction>
  ) => {
    await financeRepository.updateTransaction(id, updates, cards);
    await loadData();
    toastRef.current?.show({
      severity: 'info',
      summary: 'Lançamento Atualizado',
      detail: 'As alterações foram salvas com sucesso.',
      life: 2500
    });
  };

  const handleToggleStatus = async (tx: Transaction) => {
    const updated = await financeRepository.toggleTransactionStatus(tx);
    await loadData();

    const isNowPaid = updated.status === 'paid';
    toastRef.current?.show({
      severity: isNowPaid ? 'success' : 'warn',
      summary: isNowPaid
        ? tx.type === 'income'
          ? 'Entrada Recebida!'
          : 'Conta Paga!'
        : 'Status Revertido para Pendente',
      detail: `${tx.description} (${formatBRL(tx.amount)})`,
      life: 2800
    });
  };

  const handlePayCardInvoice = async (cardId: string, cardName: string) => {
    const paidCount = await financeRepository.payCardInvoice(
      cardId,
      competenceMonth
    );
    await loadData();
    toastRef.current?.show({
      severity: 'success',
      summary: `Fatura ${cardName} Quitada!`,
      detail: `${paidCount} compra(s) da fatura de ${formatCompetenceMonthBR(
        competenceMonth
      )} marcada(s) como paga(s).`,
      life: 3500
    });
  };

  const handleConfirmDelete = async (scope: 'single' | 'all_group') => {
    if (!deletingTx) return;
    await financeRepository.deleteTransaction(deletingTx, scope);
    setDeletingTx(null);
    await loadData();
    toastRef.current?.show({
      severity: 'warn',
      summary: 'Lançamento Excluído',
      detail:
        scope === 'all_group'
          ? 'Toda a série recorrente/parcelada foi removida.'
          : 'O registro selecionado foi removido.',
      life: 3000
    });
  };

  const handleCreateCategory = async (
    cat: Omit<Category, 'id' | 'created_at' | 'user_id'>
  ) => {
    await financeRepository.createCategory(cat);
    await loadData();
    toastRef.current?.show({
      severity: 'success',
      summary: 'Categoria Criada',
      detail: `A categoria "${cat.name}" já está disponível.`,
      life: 2500
    });
  };

  const handleDeleteCategory = async (id: string) => {
    await financeRepository.deleteCategory(id);
    await loadData();
    toastRef.current?.show({
      severity: 'info',
      summary: 'Categoria Removida',
      detail: 'A categoria foi excluída.',
      life: 2500
    });
  };

  const handleCreateCard = async (
    card: Omit<PaymentCard, 'id' | 'created_at' | 'user_id'>
  ) => {
    await financeRepository.createCard(card);
    await loadData();
    toastRef.current?.show({
      severity: 'success',
      summary: 'Cartão Cadastrado',
      detail: `O cartão "${card.name}" foi adicionado com sucesso.`,
      life: 2800
    });
  };

  const handleUpdateCard = async (
    cardId: string,
    updates: Partial<Omit<PaymentCard, 'id' | 'created_at' | 'user_id'>>
  ) => {
    await financeRepository.updateCard(cardId, updates);
    await loadData();
    toastRef.current?.show({
      severity: 'info',
      summary: 'Cartão Atualizado',
      detail: 'As configurações do cartão foram salvas.',
      life: 2500
    });
  };

  const handleDeleteCard = async (cardId: string) => {
    await financeRepository.deleteCard(cardId);
    await loadData();
    toastRef.current?.show({
      severity: 'warn',
      summary: 'Cartão Removido',
      detail: 'O cartão foi excluído.',
      life: 2500
    });
  };

  const defaultModalDate = React.useMemo(() => {
    const now = new Date();
    if (
      now.getFullYear() === selectedMonthDate.getFullYear() &&
      now.getMonth() === selectedMonthDate.getMonth()
    ) {
      return now;
    }
    return selectedMonthDate;
  }, [selectedMonthDate]);

  return (
    <main className="min-h-screen px-3 py-3 md:px-5 md:py-4 max-w-screen">
      <Toast ref={toastRef} position="bottom-right" />

      <div className="mx-auto" style={{ maxWidth: '1400px' }}>
        <Header
          selectedMonthDate={selectedMonthDate}
          onMonthChange={setSelectedMonthDate}
          onOpenNewTransaction={handleOpenNewTransaction}
          onOpenCards={() => setCardModalVisible(true)}
          onOpenCategories={() => setCatModalVisible(true)}
          onOpenCloudModal={() => setAuthModalVisible(true)}
          darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
          storageMode={storageMode}
          userEmail={userEmail}
        />

        <SummaryCards
          summary={summary}
          onFilterSelect={(tab) => setActiveTab(tab)}
        />

        <BillsToPaySection
          transactions={transactions}
          categories={categories}
          cards={cards}
          competenceMonth={competenceMonth}
          onTogglePaid={handleToggleStatus}
          onPayCardInvoice={handlePayCardInvoice}
          onEdit={handleOpenEditTransaction}
          onOpenNewBill={handleOpenNewTransaction}
        />

        <CategoryCharts
          transactions={transactions}
          categories={categories}
          summary={summary}
          darkMode={darkMode}
        />

        <TransactionList
          transactions={transactions}
          categories={categories}
          cards={cards}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onToggleStatus={handleToggleStatus}
          onEdit={handleOpenEditTransaction}
          onDeleteRequest={(tx) => setDeletingTx(tx)}
        />
      </div>

      {/* Modal de Criar/Editar Lançamento */}
      <TransactionModal
        visible={txModalVisible}
        onHide={() => setTxModalVisible(false)}
        categories={categories}
        cards={cards}
        editingTransaction={editingTx}
        initialPreset={txPreset}
        defaultDate={defaultModalDate}
        onOpenManageCards={() => setCardModalVisible(true)}
        onSaveCreate={handleSaveCreate}
        onSaveUpdate={handleSaveUpdate}
      />

      {/* Modal de Meus Cartões */}
      <CardModal
        visible={cardModalVisible}
        onHide={() => setCardModalVisible(false)}
        cards={cards}
        onCreateCard={handleCreateCard}
        onUpdateCard={handleUpdateCard}
        onDeleteCard={handleDeleteCard}
      />

      {/* Modal de Categorias */}
      <CategoryModal
        visible={catModalVisible}
        onHide={() => setCatModalVisible(false)}
        categories={categories}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      {/* Modal de Nuvem Supabase / Backup */}
      <AuthModal
        visible={authModalVisible}
        onHide={() => setAuthModalVisible(false)}
        storageMode={storageMode}
        userEmail={userEmail}
        onAuthChange={loadData}
      />

      {/* Diálogo de Confirmação de Exclusão */}
      <Dialog
        header={
          <div className="flex align-items-center gap-2 text-red-500">
            <i className="pi pi-exclamation-triangle text-xl" />
            <span>Confirmar Exclusão</span>
          </div>
        }
        visible={Boolean(deletingTx)}
        onHide={() => setDeletingTx(null)}
        style={{ width: '92vw', maxWidth: '460px' }}
        modal
        draggable={false}
      >
        {deletingTx && (
          <div className="flex flex-column gap-3">
            <p className="m-0 line-height-3">
              Deseja realmente excluir o lançamento{' '}
              <strong>&ldquo;{deletingTx.description}&rdquo;</strong> no valor de{' '}
              <strong>{formatBRL(deletingTx.amount)}</strong>?
            </p>

            {deletingTx.recurrence_group_id ? (
              <div className="flex flex-column gap-2 mt-2">
                <Button
                  label="Excluir apenas este mês / parcela"
                  icon="pi pi-trash"
                  severity="danger"
                  outlined
                  onClick={() => handleConfirmDelete('single')}
                />
                <Button
                  label="Excluir toda a série / todas as parcelas"
                  icon="pi pi-times-circle"
                  severity="danger"
                  onClick={() => handleConfirmDelete('all_group')}
                />
                <Button
                  label="Cancelar"
                  text
                  severity="secondary"
                  onClick={() => setDeletingTx(null)}
                />
              </div>
            ) : (
              <div className="flex justify-content-end gap-2 mt-2">
                <Button
                  label="Cancelar"
                  text
                  severity="secondary"
                  onClick={() => setDeletingTx(null)}
                />
                <Button
                  label="Excluir Lançamento"
                  icon="pi pi-trash"
                  severity="danger"
                  onClick={() => handleConfirmDelete('single')}
                />
              </div>
            )}
          </div>
        )}
      </Dialog>
    </main>
  );
}
