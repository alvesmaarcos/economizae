import React from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';

interface LinkResponse {
  linked: boolean;
  url?: string;
  error?: string;
}

export default function TelegramLinkDialog({ client, onClose }: { client: SupabaseClient; onClose: () => void }) {
  const [linked, setLinked] = React.useState<boolean>();
  const [linkUrl, setLinkUrl] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);

  const updateLink = React.useCallback(async (method: 'GET' | 'POST' | 'DELETE', signal?: AbortSignal) => {
    setBusy(true);
    setError(undefined);
    try {
      const { data } = await client.auth.getSession();
      if (!data.session) throw new Error('Entre novamente para configurar o Telegram.');
      const response = await fetch('/api/telegram/link', {
        method, signal, headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      const result = await response.json() as LinkResponse;
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível configurar o Telegram.');
      if (signal?.aborted) return;
      setLinked(result.linked);
      if (result.linked || method !== 'GET') setLinkUrl(result.url);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível configurar o Telegram.');
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, [client]);

  React.useEffect(() => {
    const controller = new AbortController();
    void updateLink('GET', controller.signal);
    return () => controller.abort();
  }, [updateLink]);

  return (
    <Dialog header="Telegram" visible onHide={onClose} style={{ width: '28rem', maxWidth: '95vw' }}>
      <div className="flex flex-column gap-3">
        {error && <Message severity="error" text={error} />}
        {linked === undefined && (busy ? <span role="status">Verificando vínculo…</span>
          : <Button label="Verificar novamente" outlined onClick={() => void updateLink('GET')} />)}
        {linked === true && (
          <>
            <Message severity="success" text="Telegram vinculado à sua conta." />
            <p className="m-0">Envie uma despesa ao bot e confirme o resumo pelo chat.</p>
            <Button label="Desvincular Telegram" severity="secondary" outlined loading={busy}
              onClick={() => void updateLink('DELETE')} />
          </>
        )}
        {linked === false && (
          <>
            <p className="m-0">Vincule seu chat para registrar despesas por mensagem. O Gemini interpreta o texto e o bot pede sua confirmação.</p>
            {linkUrl ? (
              <>
                <a className="p-button p-component justify-content-center no-underline" href={linkUrl}
                  target="_blank" rel="noopener noreferrer">
                  Abrir bot no Telegram
                </a>
                <p className="m-0 text-sm">Toque em Iniciar no bot. O link vale por 10 minutos.</p>
                <Button label="Verificar vínculo" loading={busy} onClick={() => void updateLink('GET')} />
              </>
            ) : (
              <p className="m-0 text-sm">No plano gratuito do Gemini, o Google pode usar o texto das mensagens para melhorar seus produtos.</p>
            )}
            <Button label={linkUrl ? 'Gerar novo link' : 'Vincular Telegram'} outlined={Boolean(linkUrl)}
              disabled={busy && Boolean(linkUrl)} loading={busy && !linkUrl} onClick={() => void updateLink('POST')} />
          </>
        )}
      </div>
    </Dialog>
  );
}
