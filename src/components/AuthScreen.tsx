'use client';

import React from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';

export default function AuthScreen({
  supabase,
  sessionError
}: {
  supabase: SupabaseClient;
  sessionError: string | null;
}) {
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
          text: 'Confira seu e-mail para confirmar a conta e entrar.'
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
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

  return (
    <main className="min-h-screen flex align-items-center justify-content-center p-3">
      <section className="surface-card border-1 surface-border border-round-xl shadow-2 p-4 w-full" style={{ maxWidth: '26rem' }}>
        <div className="flex align-items-center gap-2">
          <i className="pi pi-wallet text-primary text-xl" aria-hidden="true" />
          <span className="font-bold text-xl">Economizaê</span>
        </div>
        <h1 className="text-2xl mt-4 mb-3">{isSignUp ? 'Criar conta' : 'Entrar'}</h1>
        {sessionError && (
          <Message severity="error" text={sessionError} className="w-full mb-3" />
        )}
        <form onSubmit={handleAuthSubmit} className="flex flex-column gap-3">
          {feedback && (
            <Message
              severity={feedback.severity}
              text={feedback.text}
              className="w-full"
            />
          )}
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium mb-1">E-mail</label>
            <InputText
              id="auth-email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full"
              required
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium mb-1">Senha</label>
            <Password
              inputId="auth-password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={isSignUp ? 6 : undefined}
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
                  ? 'Já tenho conta'
                  : 'Criar nova conta'
              }
              link
              size="small"
              disabled={loading}
              onClick={() => {
                setIsSignUp(!isSignUp);
                setFeedback(null);
              }}
            />
            <Button
              type="submit"
              label={isSignUp ? 'Cadastrar' : 'Entrar'}
              icon="pi pi-user"
              loading={loading}
            />
          </div>
        </form>
      </section>
    </main>
  );
}
