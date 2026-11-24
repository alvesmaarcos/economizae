import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

function post(message: object, secret?: string) {
  return POST(new Request('https://example.test/api/telegram/webhook', {
    method: 'POST', headers: secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {},
    body: JSON.stringify(message)
  }));
}

const link = { id: 'a2376639-83e7-45b6-bbcc-628db7f94324', user_id: 'account1', linked_at: '2020-01-01T00:00:00Z' };
const draftId = '8d96cf53-0f50-4439-bcbd-a085aa42c4d9';
const secret = 'test_webhook_secret_32_characters_minimum';
const message = () => ({ message: {
  from: { id: 123 }, chat: { id: 123, type: 'private' },
  message_id: 25, date: Math.floor(Date.now() / 1000), text: '-25 corte de cabelo'
} });

beforeEach(() => {
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', secret);
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-bot');
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://database.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Telegram webhook', () => {
  it('rejects unauthenticated updates before sending any service request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await post(message(), 'wrong')).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports an unavailable Gemini without saving a draft or any transaction', async () => {
    const fetch = vi.fn(async (resource: string | URL | Request, options?: RequestInit) => {
      const url = new URL(String(resource));
      if (url.pathname.endsWith('/telegram_links')) return Response.json(link);
      if (url.pathname.endsWith('/telegram_drafts') && options?.method !== 'POST') return Response.json([]);
      if (url.hostname === 'generativelanguage.googleapis.com') return new Response(null, { status: 429 });
      if (url.pathname.endsWith('/sendMessage')) return Response.json({ ok: true, result: { message_id: 30 } });
      throw new Error('Unexpected request');
    });
    vi.stubGlobal('fetch', fetch);
    expect((await post(message(), secret)).status).toBe(200);
    const requests = fetch.mock.calls;
    expect(requests.some(([url, request]) => String(url).includes('/telegram_drafts') && request?.method === 'POST')).toBe(false);
    expect(requests.some(([url, request]) => String(url).endsWith('/sendMessage') && String(request?.body).includes('Gemini'))).toBe(true);
    expect(requests.some(([url]) => String(url).includes('/transactions'))).toBe(false);
  });

  it('reports database errors in the chat and logs only the step and safe error code', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetch = vi.fn(async (resource: string | URL | Request) => {
      const url = new URL(String(resource));
      if (url.pathname.endsWith('/telegram_links')) {
        return Response.json({ code: '42501', message: 'private database details' }, { status: 403 });
      }
      if (url.pathname.endsWith('/sendMessage')) return Response.json({ ok: true, result: { message_id: 30 } });
      throw new Error('Unexpected request');
    });
    vi.stubGlobal('fetch', fetch);
    expect((await post(message(), secret)).status).toBe(200);
    expect(errorLog.mock.calls).toEqual([
      ['Telegram database operation failed', { stage: 'load_link', code: '42501' }]
    ]);
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/sendMessage'))).toBe(true);
  });

  it('stores a draft and sends its buttons once for a repeated message, then resolves only on callback', async () => {
    let saved: Record<string, unknown> | undefined;
    let confirmed = false;
    const fetch = vi.fn(async (resource: string | URL | Request, options?: RequestInit) => {
      const url = new URL(String(resource));
      const method = options?.method;
      if (url.pathname.endsWith('/telegram_links')) return Response.json(link);
      if (url.pathname.endsWith('/telegram_drafts')) {
        if (method === 'POST') {
          saved = { ...JSON.parse(String(options?.body)), id: draftId, expires_at: new Date(Date.now() + 60000).toISOString() };
          return new Response(null, { status: 201 });
        }
        if (method === 'PATCH') {
          Object.assign(saved!, JSON.parse(String(options?.body)));
          return new Response(null, { status: 204 });
        }
        return Response.json(method !== 'DELETE' && saved ? [saved] : []);
      }
      if (url.hostname === 'generativelanguage.googleapis.com') {
        return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({
          intent: 'expense', description: 'corte de cabelo', amount_cents: 2500, amount_kind: null, status: 'paid',
          method: 'pix', card_name: null, purchase_date: null, due_date: null, paid_date: null,
          current: null, total: null, remaining: null, remaining_includes_current: null, question: null
        }) }] } }] });
      }
      if (url.pathname.endsWith('/resolve_telegram_draft')) {
        expect(JSON.parse(String(options?.body))).toEqual({ draft: draftId, sender: 123, should_confirm: true });
        confirmed = true;
        return Response.json({ status: 'confirmed', count: 1 });
      }
      if (url.hostname === 'api.telegram.org') return Response.json({ ok: true, result: { message_id: 30 } });
      throw new Error('Unexpected request');
    });
    vi.stubGlobal('fetch', fetch);
    expect((await post(message(), secret)).status).toBe(200);
    expect((await post(message(), secret)).status).toBe(200);
    expect(confirmed).toBe(false);
    expect(saved).toMatchObject({ status: 'ready', transactions: [{ amount: 25, status: 'paid', payment_method: 'pix' }] });
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/cards'))).toBe(false);
    const replies = fetch.mock.calls.filter(([url]) => String(url).endsWith('/sendMessage'));
    expect(replies).toHaveLength(1);
    expect(JSON.parse(String(replies[0][1]?.body)).reply_markup.inline_keyboard[0]).toEqual([
      { text: 'Confirmar', callback_data: `confirm:${draftId}` }, { text: 'Cancelar', callback_data: `cancel:${draftId}` }
    ]);
    expect((await post({ callback_query: {
      id: 'callback', data: `confirm:${draftId}`, from: { id: 123 }, message: { chat: { id: 123, type: 'private' }, message_id: 30 }
    } }, secret)).status).toBe(200);
    expect(confirmed).toBe(true);
  });
});
