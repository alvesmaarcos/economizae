'use client';

import React from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Message } from 'primereact/message';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthModalProps {
  visible: boolean;
  onHide: () => void;
  storageMode: 'supabase' | 'local';
  userEmail: string | null;
  onAuthChange: () => void;
}

export default function AuthModal({
  visible,
  onHide,
  storageMode,
  userEmail,
  onAuthChange
}: AuthModalProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    severity: 'success' | 'info' | 'warn' | 'error';
    text: string;
  } | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setFeedback(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password
        });
        if (error) throw error;
        setFeedback({
          severity: 'success',
          text: 'Conta criada! Verifique seu e-mail ou faça login.'
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
        setFeedback({
          severity: 'success',
          text: 'Autenticado com sucesso no Supabase!'
        });
        onAuthChange();
      }
    } catch (err) {
      setFeedback({
        severity: 'error',
        text: err instanceof Error ? err.message : 'Falha na autenticação.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    onAuthChange();
  };

  const handleExportLocalBackup = () => {
    const transactions = window.localStorage.getItem(
      'economizae_transactions_v1'
    );
    const categories = window.localStorage.getItem('economizae_categories_v1');
    const payload = {
      exportedAt: new Date().toISOString(),
      transactions: transactions ? JSON.parse(transactions) : [],
      categories: categories ? JSON.parse(categories) : []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `economizae-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      header={
        <div className="flex align-items-center gap-2">
          <i className="pi pi-cloud text-primary text-xl" />
          <span>Sincronização na Nuvem (Supabase) & Backup</span>
        </div>
      }
      visible={visible}
      onHide={onHide}
      style={{ width: '95vw', maxWidth: '540px' }}
      modal
      draggable={false}
    >
      <div className="flex flex-column gap-3">
        <div className="surface-ground p-3 border-round-lg border-1 surface-border flex align-items-center justify-content-between">
          <div>
            <span className="text-xs text-color-secondary block">
              MODO DE ARMAZENAMENTO ATUAL
            </span>
            <strong className="text-base">
              {storageMode === 'supabase'
                ? `Sincronizado na Nuvem (${userEmail})`
                : 'Armazenamento Local no Navegador'}
            </strong>
          </div>
          <Tag
            value={storageMode === 'supabase' ? 'Online' : 'Local Ativo'}
            severity={storageMode === 'supabase' ? 'success' : 'info'}
            icon={
              storageMode === 'supabase' ? 'pi pi-cloud' : 'pi pi-database'
            }
          />
        </div>

        {!isSupabaseConfigured ? (
          <div className="flex flex-column gap-2">
            <Message
              severity="info"
              text="O aplicativo está funcionando 100% no Modo Local! Para ativar a sincronização em nuvem com o Supabase:"
              className="w-full justify-content-start"
            />
            <ol className="text-sm line-height-3 pl-4 m-0 text-color-secondary">
              <li>
                Execute o script <code>supabase/schema.sql</code> no SQL Editor
                do seu projeto Supabase.
              </li>
              <li>
                Copie o arquivo <code>.env.example</code> para{' '}
                <code>.env.local</code> e preencha{' '}
                <code>NEXT_PUBLIC_SUPABASE_URL</code> e{' '}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
              </li>
              <li>Reinicie o servidor para fazer login com seu e-mail.</li>
            </ol>
          </div>
        ) : userEmail ? (
          <div className="flex flex-column gap-3">
            <Message
              severity="success"
              text={`Você está conectado ao Supabase como ${userEmail}. Seus lançamentos estão protegidos por Row Level Security (RLS).`}
            />
            <Button
              label="Sair da Conta (Voltar ao Modo Local)"
              icon="pi pi-sign-out"
              severity="secondary"
              outlined
              onClick={handleLogout}
            />
          </div>
        ) : (
          <form onSubmit={handleAuthSubmit} className="flex flex-column gap-3">
            {feedback && (
              <Message
                severity={feedback.severity}
                text={feedback.text}
                className="w-full"
              />
            )}
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <InputText
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Senha</label>
              <Password
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                feedback={isSignUp}
                toggleMask
                className="w-full"
                inputClassName="w-full"
                required
              />
            </div>
            <div className="flex justify-content-between align-items-center">
              <Button
                type="button"
                label={
                  isSignUp
                    ? 'Já tenho uma conta (Fazer Login)'
                    : 'Criar nova conta'
                }
                link
                size="small"
                onClick={() => setIsSignUp(!isSignUp)}
              />
              <Button
                type="submit"
                label={isSignUp ? 'Cadastrar' : 'Entrar no Supabase'}
                icon="pi pi-user"
                loading={loading}
              />
            </div>
          </form>
        )}

        <div className="border-top-1 surface-border pt-3 mt-2 flex justify-content-between align-items-center">
          <div>
            <span className="font-semibold text-sm block">
              Backup Local (JSON)
            </span>
            <span className="text-xs text-color-secondary">
              Exporte uma cópia de segurança dos seus lançamentos locais
            </span>
          </div>
          <Button
            label="Exportar JSON"
            icon="pi pi-download"
            size="small"
            outlined
            onClick={handleExportLocalBackup}
          />
        </div>
      </div>
    </Dialog>
  );
}
