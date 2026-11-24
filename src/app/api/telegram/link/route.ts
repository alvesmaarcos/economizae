import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createTelegramDatabase, hashTelegramCode, telegramIsConfigured, telegramRequest } from '@/server/telegram-services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function manageLink(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: 'Entre na sua conta para configurar o Telegram.' }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !publicKey || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || (request.method === 'POST' && !telegramIsConfigured())) {
    return json({ error: 'A integração com o Telegram ainda não foi configurada.' }, 503);
  }

  try {
    const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return json({ error: 'Sua sessão expirou. Entre novamente para continuar.' }, 401);
    const db = createTelegramDatabase();

    if (request.method === 'GET') {
      const { data, error } = await db.from('telegram_links').select('linked_at').eq('user_id', user.id).maybeSingle();
      if (error) throw new Error('Could not look up Telegram link');
      return json({ linked: Boolean(data?.linked_at) });
    }
    if (request.method === 'DELETE') {
      const { error } = await db.from('telegram_links').delete().eq('user_id', user.id);
      if (error) throw new Error('Could not revoke Telegram link');
      return json({ linked: false });
    }

    const { username } = await telegramRequest<{ username?: string }>('getMe');
    if (!username || !/^[A-Za-z0-9_]{5,32}$/.test(username)) throw new Error('Invalid Telegram bot username');
    const code = randomBytes(32).toString('base64url');
    const { data: issued, error } = await db.rpc('issue_telegram_link', {
      account: user.id, hashed_code: hashTelegramCode(code)
    });
    if (error) throw new Error('Could not issue Telegram link');
    if (!issued) return json({ linked: true });
    return json({ linked: false, url: `https://t.me/${username}?start=${code}` });
  } catch {
    return json({ error: 'Não foi possível configurar o Telegram agora. Tente novamente em instantes.' }, 503);
  }
}

export const GET = manageLink;
export const POST = manageLink;
export const DELETE = manageLink;
