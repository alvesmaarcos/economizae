import { NextResponse } from 'next/server';
import { prepareExpense, readExpenseExtraction, saoPauloDate } from '@/lib/telegram-expense';
import {
  createTelegramDatabase, extractExpense, hashTelegramCode, telegramIsConfigured,
  telegramRequest, webhookIsAuthentic
} from '@/server/telegram-services';

export const runtime = 'nodejs';
export const maxDuration = 45;

type Database = ReturnType<typeof createTelegramDatabase>;
type TelegramUser = { id: number; is_bot?: boolean };
type TelegramMessage = {
  chat: { id: number; type: string };
  from?: TelegramUser;
  message_id: number;
  date: number;
  text?: string;
  reply_to_message?: { message_id: number };
};
type TelegramCallback = { id: string; from: TelegramUser; data?: string; message?: TelegramMessage };
type Draft = {
  id: string;
  status: 'clarify' | 'ready' | 'confirmed' | 'cancelled' | 'invalid';
  summary: string | null;
  expires_at: string;
  notified_at: string | null;
};

const messageHelp = 'Envie uma despesa como “-25 corte de cabelo” ou “R$ 120 por parcela, geladeira, parcela 3 de 10 no Nubank, vence em 10/12 e ainda não paguei”. Você verá um resumo antes de confirmar.';
const linkHelp = 'Entre no Economizaê e use Telegram → Vincular Telegram para conectar este chat à sua conta.';

function sendMessage(chatId: number, text: string, replyMarkup?: object) {
  return telegramRequest<{ message_id: number }>('sendMessage', {
    chat_id: chatId, text, reply_markup: replyMarkup
  });
}

async function handleCallback(db: Database, callback: TelegramCallback) {
  const message = callback.message;
  const match = /^(confirm|cancel):([a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.exec(callback.data ?? '');
  if (typeof callback.id !== 'string' || !callback.from) return;
  if (!match || message?.chat?.type !== 'private' || message.chat.id !== callback.from.id
    || !Number.isSafeInteger(callback.from.id) || callback.from.is_bot) {
    await telegramRequest('answerCallbackQuery', { callback_query_id: callback.id });
    return;
  }

  const [, decision, draftId] = match;
  const { data, error } = await db.rpc('resolve_telegram_draft', {
    draft: draftId, sender: callback.from.id, should_confirm: decision === 'confirm'
  });
  if (error) throw new Error('Could not resolve Telegram draft');
  const result = data as { status: string; count?: number };
  const notice = result.status === 'confirmed'
    ? result.count === 1 ? 'Despesa registrada.' : `${result.count} parcelas registradas.`
    : result.status === 'cancelled' ? 'Lançamento cancelado.'
    : result.status === 'invalid' ? 'O cartão mudou ou foi removido. Envie a despesa novamente.'
    : 'Este rascunho expirou ou não está disponível. Envie a despesa novamente.';

  await Promise.allSettled([
    telegramRequest('answerCallbackQuery', { callback_query_id: callback.id, text: notice }),
    telegramRequest('editMessageText', {
      chat_id: message.chat.id, message_id: message.message_id, text: notice,
      reply_markup: { inline_keyboard: [] }
    })
  ]);
}

async function deliverDraft(db: Database, chatId: number, draft: Draft) {
  if (draft.notified_at || !draft.summary || Date.parse(draft.expires_at) <= Date.now()) return;
  const replyMarkup = draft.status === 'clarify' ? { force_reply: true }
    : draft.status === 'ready' ? { inline_keyboard: [[
      { text: 'Confirmar', callback_data: `confirm:${draft.id}` },
      { text: 'Cancelar', callback_data: `cancel:${draft.id}` }
    ]] } : undefined;
  const sent = await sendMessage(chatId, draft.summary, replyMarkup);
  const { error } = await db.from('telegram_drafts').update({
    notified_at: new Date().toISOString(),
    prompt_message_id: draft.status === 'clarify' ? sent.message_id : null
  }).eq('id', draft.id).eq('status', draft.status).is('notified_at', null);
  if (error) throw new Error('Could not mark Telegram draft as delivered');
}

async function handleMessage(db: Database, message: TelegramMessage) {
  if (message.chat?.type !== 'private' || message.from?.is_bot || message.from?.id !== message.chat.id
    || !Number.isSafeInteger(message.chat.id) || !Number.isSafeInteger(message.message_id)
    || !Number.isSafeInteger(message.date) || message.date * 1000 < Date.now() - 86_400_000) return;
  const chatId = message.chat.id;
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const { data: link, error: linkError } = await db.from('telegram_links')
    .select('id, user_id, linked_at').eq('chat_id', chatId).maybeSingle();
  if (linkError) throw new Error('Could not look up Telegram link');

  if (/^\/start(?:\s|$)/.test(text)) {
    if (link) {
      await sendMessage(chatId, `Telegram vinculado ao Economizaê. ${messageHelp}`);
      return;
    }
    const code = /^\/start ([A-Za-z0-9_-]{43})$/.exec(text)?.[1];
    if (code) {
      const { data: linked, error } = await db.rpc('redeem_telegram_link', {
        hashed_code: hashTelegramCode(code), sender: chatId
      });
      if (error) throw new Error('Could not redeem Telegram link');
      if (linked) {
        await sendMessage(chatId, `Telegram vinculado ao Economizaê. ${messageHelp}`);
        return;
      }
    }
    await sendMessage(chatId, linkHelp);
    return;
  }

  if (!link) {
    await sendMessage(chatId, linkHelp);
    return;
  }
  if (message.date < Math.floor(Date.parse(link.linked_at) / 1000)) return;
  if (!text || text.startsWith('/')) {
    await sendMessage(chatId, messageHelp);
    return;
  }
  if (text.length > 1500) {
    await sendMessage(chatId, 'Envie uma despesa por vez, em até 1.500 caracteres.');
    return;
  }

  const drafts = () => db.from('telegram_drafts').select('id, status, summary, expires_at, notified_at')
    .eq('link_id', link.id).eq('message_id', message.message_id).maybeSingle<Draft>();
  const { data: existingDraft, error: existingError } = await drafts();
  if (existingError) throw new Error('Could not look up Telegram draft');
  if (existingDraft) {
    await deliverDraft(db, chatId, existingDraft);
    return;
  }

  const { error: cleanupError } = await db.from('telegram_drafts').delete().eq('link_id', link.id)
    .lt('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
  if (cleanupError) throw new Error('Could not clean up Telegram drafts');
  const replyId = message.reply_to_message?.message_id;
  let previous;
  if (Number.isSafeInteger(replyId)) {
    const { data: prompt, error } = await db.from('telegram_drafts').select('input, summary, expires_at')
      .eq('link_id', link.id).eq('status', 'clarify').eq('prompt_message_id', replyId).maybeSingle();
    if (error) throw new Error('Could not look up Telegram clarification');
    if (prompt && Date.parse(prompt.expires_at) <= Date.now()) {
      await sendMessage(chatId, 'Esse pedido de esclarecimento expirou. Envie a despesa novamente com todos os dados.');
      return;
    }
    if (prompt?.input && prompt.summary) {
      previous = { input: readExpenseExtraction(prompt.input), question: prompt.summary };
    }
  }

  const today = saoPauloDate(new Date(message.date * 1000));
  let extracted;
  try {
    extracted = await extractExpense(text, today, previous);
  } catch {
    await sendMessage(chatId, 'O Gemini não conseguiu interpretar a mensagem agora. Tente enviar novamente em instantes.');
    return;
  }
  const { data: cards, error: cardsError } = await db.from('cards')
    .select('id, name, modality, color, closing_day, due_day, credit_limit').eq('user_id', link.user_id);
  if (cardsError) throw new Error('Could not load account cards');
  const draft = prepareExpense(extracted, cards, today);
  const { error: insertError } = await db.from('telegram_drafts').upsert({
    link_id: link.id, message_id: message.message_id, status: draft.status, summary: draft.summary,
    input: draft.status === 'clarify' ? extracted : null,
    transactions: draft.status === 'ready' ? draft.transactions : null
  }, { onConflict: 'link_id,message_id', ignoreDuplicates: true });
  if (insertError?.code === '23503') return; // The account revoked this link while Gemini was processing.
  if (insertError) throw new Error('Could not save Telegram draft');
  const { data: savedDraft, error: readError } = await drafts();
  if (readError) throw new Error('Could not read saved Telegram draft');
  if (savedDraft) await deliverDraft(db, chatId, savedDraft);
}

export async function POST(request: Request) {
  if (!webhookIsAuthentic(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return new Response(null, { status: 403 });
  }
  if (!telegramIsConfigured()) return new Response(null, { status: 503 });
  const update = await request.json().catch(() => null) as {
    message?: TelegramMessage;
    callback_query?: TelegramCallback;
  } | null;
  if (!update || typeof update !== 'object') return new Response(null, { status: 400 });

  try {
    const db = createTelegramDatabase();
    if (update.callback_query) await handleCallback(db, update.callback_query);
    else if (update.message) await handleMessage(db, update.message);
    return NextResponse.json({ ok: true });
  } catch {
    console.error('Telegram webhook processing failed');
    return new Response(null, { status: 503 });
  }
}
