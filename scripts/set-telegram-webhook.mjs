const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

async function registerWebhook() {
  if (!token || !secret || !/^[A-Za-z0-9_-]{32,256}$/.test(secret)) {
    throw new Error('Configure TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET no ambiente.');
  }
  let base;
  try {
    base = new URL(process.argv[2]);
    if (base.protocol !== 'https:' || base.username || base.password) throw new Error();
  } catch {
    throw new Error('Informe a URL HTTPS pública do Economizaê.');
  }
  const url = new URL('/api/telegram/webhook', base).href;
  const endpoint = `https://api.telegram.org/bot${token}`;
  const options = {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000)
  };
  const result = await fetch(`${endpoint}/setWebhook`, {
    ...options,
    body: JSON.stringify({ url, secret_token: secret, allowed_updates: ['message', 'callback_query'], max_connections: 1 })
  }).then(response => response.json()).catch(() => null);
  if (result?.ok !== true || result?.result !== true) {
    throw new Error('O Telegram não conseguiu registrar o webhook. Confira o token e a URL pública.');
  }
  const info = await fetch(`${endpoint}/getWebhookInfo`, {
    ...options, signal: AbortSignal.timeout(10000)
  }).then(response => response.json()).catch(() => null);
  if (info?.ok !== true || info?.result?.url !== url) throw new Error('Não foi possível verificar o webhook no Telegram.');
  console.log(`Webhook registrado e verificado: ${url}`);
}

registerWebhook().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
