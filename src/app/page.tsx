'use client';

import React from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Message } from 'primereact/message';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import Header from '@/components/Header';
import BalanceAdjustmentDialog from '@/components/BalanceAdjustmentDialog';
import SummaryCards from '@/components/SummaryCards';
import BillsToPaySection from '@/components/BillsToPaySection';
import CategoryCharts from '@/components/CategoryCharts';
import TransactionList, {
  TransactionTabFilter
} from '@/components/TransactionList';
import TransactionModal from '@/components/TransactionModal';
import CategoryModal from '@/components/CategoryModal';
import CardModal from '@/components/CardModal';
import AuthScreen from '@/components/AuthScreen';
import { supabase } from '@/lib/supabase';
import {
  Category,
  CreateTransactionInput,
  PaymentCard,
  Transaction
} from '@/types/finance';
import {
  calculateMonthlySummary,
  formatBRL,
  formatCompetenceMonthBR,
  formatDateBR,
  getCompetenceMonth,
  getBalanceReferenceDate
} from '@/lib/finance-calculations';
import { setupPrimeReactLocale } from '@/lib/primereact-locale';
import { createFinanceRepository } from '@/services/finance-repository';

const legacyFinanceKeys = [
  'economizae_transactions_v1',
  'economizae_categories_v1',
  'economizae_cards_v1',
  'economizae_seeded_v1'
];

export default function HomePage() {
  const [darkMode, setDarkMode] = React.useState(false);

  React.useEffect(() => {
    setupPrimeReactLocale();
    try {
      for (const key of legacyFinanceKeys) window.localStorage.removeItem(key);
      setDarkMode(window.localStorage.getItem('economizae_dark_mode') === 'true');
    } catch {
      // The sign-in screen can still render if browser storage is blocked.
    }
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark-theme', darkMode);
  }, [darkMode]);

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    try {
      window.localStorage.setItem('economizae_dark_mode', String(next));
    } catch {
      // Keep the selected theme for this page even without browser storage.
    }
  }

  if (!supabase) {
    return (
      <main className="p-4">
        <Message severity="error" text="O Supabase não está configurado. Confira a URL e a chave pública da aplicação." />
      </main>
    );
  }

  return <AuthenticatedApp client={supabase} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />;
}

function AuthenticatedApp({
  client,
  darkMode,
  onToggleDarkMode
}: {
  client: SupabaseClient;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}) {
  const [session, setSession] = React.useState<Session | null>();
  const [sessionError, setSessionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    let sessionChanged = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active || event === 'INITIAL_SESSION') return;
      sessionChanged = true;
      setSessionError(null);
      setSession(nextSession);
    });

    void client.auth.getSession().then(({ data, error }) => {
      if (!active || sessionChanged) return;
      setSessionError(error?.message ?? null);
      setSession(error ? null : data.session);
    }).catch((error: unknown) => {
      if (!active || sessionChanged) return;
      setSessionError(error instanceof Error ? error.message : 'Não foi possível verificar a sessão.');
      setSession(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  if (session === undefined) {
    return <main className="p-4" role="status">Verificando sessão…</main>;
  }

  if (!session) {
    return <AuthScreen supabase={client} sessionError={sessionError} />;
  }

  return (
    <Dashboard
      key={session.user.id}
      client={client}
      userId={session.user.id}
      userEmail={session.user.email ?? null}
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
    />
  );
}

function Dashboard({
  client,
  userId,
  userEmail,
  darkMode,
  onToggleDarkMode
}: {
  client: SupabaseClient;
  userId: string;
  userEmail: string | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}) {
  const financeRepository = React.useMemo(
    () => createFinanceRepository(client, userId),
    [client, userId]
  );
  const toastRef = React.useRef<Toast>(null);

  const [selectedMonthDate, setSelectedMonthDate] = React.useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0);
  });

  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [cards, setCards] = React.useState<PaymentCard[]>([]);
  const [activeTab, setActiveTab] =
    React.useState<TransactionTabFilter>('all');
  const [signingOut, setSigningOut] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [realBalance, setRealBalance] = React.useState<{
    month: string;
    date: string;
    amount: number;
  } | null>(null);
  const [editingBalance, setEditingBalance] = React.useState(false);

  // Modais
  const [txModalVisible, setTxModalVisible] = React.useState(false);
  const [editingTx, setEditingTx] = React.useState<Transaction | null>(null);
  const [txPreset, setTxPreset] = React.useState<
    Partial<CreateTransactionInput> | undefined
  >(undefined);
  const [catModalVisible, setCatModalVisible] = React.useState(false);
  const [cardModalVisible, setCardModalVisible] = React.useState(false);
  const [deletingTx, setDeletingTx] = React.useState<Transaction | null>(null);

  const competenceMonth = React.useMemo(
    () => getCompetenceMonth(selectedMonthDate),
    [selectedMonthDate]
  );

  const activeMonth = React.useRef<string | null>(null);
  const requestId = React.useRef(0);

  React.useLayoutEffect(() => {
    activeMonth.current = competenceMonth;
    return () => {
      activeMonth.current = null;
      requestId.current += 1;
    };
  }, [competenceMonth]);

  const loadData = React.useCallback(async () => {
    if (activeMonth.current !== competenceMonth) return;
    const id = ++requestId.current;
    const referenceDate = getBalanceReferenceDate(competenceMonth);

    try {
      const [cats, loadedCards, txs, cashBalance] = await Promise.all([
        financeRepository.listCategories(),
        financeRepository.listCards(),
        financeRepository.listTransactionsByMonth(competenceMonth),
        financeRepository.getRealBalance(referenceDate)
      ]);
      if (requestId.current !== id) return;
      setCategories(cats);
      setCards(loadedCards);
      setTransactions(txs);
      setRealBalance({ month: competenceMonth, date: referenceDate, amount: cashBalance });
      setLoadError(null);
    } catch (error) {
      if (requestId.current !== id) return;
      setLoadError(error instanceof Error ? error.message : 'Falha inesperada na leitura.');
    }
  }, [competenceMonth, financeRepository]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const displayedBalance = realBalance?.month === competenceMonth ? realBalance : null;
  const summary = React.useMemo(
    () => calculateMonthlySummary(transactions, undefined, displayedBalance?.amount),
    [transactions, displayedBalance]
  );

  async function handleSaveBalance(date: string, amount: number) {
    await financeRepository.saveBalanceAdjustment(date, amount);
    await loadData();
  }

  function showActionError(error: unknown) {
    toastRef.current?.show({
      severity: 'error',
      summary: 'Não foi possível concluir a operação',
      detail: error instanceof Error ? error.message : 'Tente novamente.',
      life: 4500
    });
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (error) {
      showActionError(error);
    } finally {
      setSigningOut(false);
    }
  }

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

    const firstTx = created.find((transaction) => transaction.status === 'pending') ?? created[0];
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
          onSignOut={handleSignOut}
          signingOut={signingOut}
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
          userEmail={userEmail}
        />

        {loadError && (
          <div className="flex align-items-center gap-2 mb-3">
            <Message severity="error" text={`Erro ao carregar dados. ${loadError}`} />
            <Button label="Tentar novamente" text onClick={loadData} />
          </div>
        )}

        <SummaryCards
          summary={summary}
          onFilterSelect={(tab) => setActiveTab(tab)}
          balanceDate={displayedBalance?.date ?? null}
          onEditBalance={() => setEditingBalance(true)}
        />

        <BillsToPaySection
          transactions={transactions}
          categories={categories}
          cards={cards}
          competenceMonth={competenceMonth}
          onTogglePaid={(tx) => handleToggleStatus(tx).catch(showActionError)}
          onPayCardInvoice={(id, name) => handlePayCardInvoice(id, name).catch(showActionError)}
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
          onToggleStatus={(tx) => handleToggleStatus(tx).catch(showActionError)}
          onEdit={handleOpenEditTransaction}
          onDeleteRequest={(tx) => setDeletingTx(tx)}
        />
      </div>

      {editingBalance && (
        <BalanceAdjustmentDialog
          referenceDate={getBalanceReferenceDate(competenceMonth)}
          onSave={handleSaveBalance}
          onHide={() => setEditingBalance(false)}
        />
      )}

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
        onDeleteCard={(id) => handleDeleteCard(id).catch(showActionError)}
      />

      {/* Modal de Categorias */}
      <CategoryModal
        visible={catModalVisible}
        onHide={() => setCatModalVisible(false)}
        categories={categories}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={(id) => handleDeleteCategory(id).catch(showActionError)}
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
                  onClick={() => handleConfirmDelete('single').catch(showActionError)}
                />
                <Button
                  label="Excluir toda a série / todas as parcelas"
                  icon="pi pi-times-circle"
                  severity="danger"
                  onClick={() => handleConfirmDelete('all_group').catch(showActionError)}
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
                  onClick={() => handleConfirmDelete('single').catch(showActionError)}
                />
              </div>
            )}
          </div>
        )}
      </Dialog>
    </main>
  );
}
