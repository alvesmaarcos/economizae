const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const webhookPath = '/api/telegram/webhook';

async function telegram(method, body) {
  if (!token) throw new Error('Configure TELEGRAM_BOT_TOKEN no ambiente local para consultar o seu bot.');
  const result = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error',
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
  }).then(response => response.json()).catch(() => null);
  if (result?.ok === true) return result.result;
  if ([401, 404].includes(result?.error_code)) throw new Error('O Telegram rejeitou o token. Confira o TELEGRAM_BOT_TOKEN do BotFather.');
  throw new Error(`O Telegram não conseguiu executar ${method}. Confira a conexão e tente novamente.`);
}

function explainStatus(status) {
  switch (status) {
    case 401: return 'A URL exige autenticação. Use o domínio público de produção em Vercel → Settings → Domains.';
    case 403: return 'O segredo do registro e o TELEGRAM_WEBHOOK_SECRET do deploy podem ser diferentes.';
    case 404:
    case 405: return 'A URL não aceita a rota do webhook. Confira o domínio de produção e a versão publicada.';
    case 503: return 'A integração está indisponível. Confira as variáveis de produção, a migração do Supabase e os logs da Vercel.';
    default: return 'Confira o domínio de produção e os logs do deploy.';
  }
}

async function showStatus() {
  const info = await telegram('getWebhookInfo');
  if (!info.url) throw new Error('O Telegram ainda não tem um webhook registrado para este bot.');
  const target = new URL(info.url);
  console.log(`Webhook cadastrado: ${target.origin}${target.pathname}`);
  console.log(`Atualizações aguardando entrega: ${info.pending_update_count}`);
  if (info.last_error_date) {
    const status = /wrong response from the webhook:\s*(\d{3})/i.exec(info.last_error_message ?? '')?.[1];
    console.log(`Último erro de entrega: ${new Date(info.last_error_date * 1000).toISOString()}`);
    if (status) console.log(`HTTP ${status}. ${explainStatus(Number(status))}`);
    else console.log('O Telegram relatou falha de conexão. Confira se a URL HTTPS aceita requisições públicas.');
  }
}

async function registerWebhook() {
  if (!token || !/^[A-Za-z0-9_-]{32,256}$/.test(secret ?? '')) {
    throw new Error('Configure TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET no ambiente local.');
  }
  let base;
  try {
    base = new URL(process.argv[2]);
    if (base.protocol !== 'https:' || base.username || base.password) throw new Error();
  } catch {
    throw new Error('Informe a URL HTTPS pública do Economizaê.');
  }
  const url = new URL(webhookPath, base).href;
  const link = await fetch(new URL('/api/telegram/link', base), {
    redirect: 'manual', signal: AbortSignal.timeout(10000)
  }).catch(() => null);
  if (!link) throw new Error('Não consegui acessar o domínio HTTPS informado.');
  const linkBody = await link.json().catch(() => null);
  if (link.status !== 401 || linkBody?.error !== 'Entre na sua conta para configurar o Telegram.') {
    const reason = link.status === 401 ? explainStatus(401) : 'Confira se a URL é do deploy do Economizaê em produção.';
    throw new Error(`A rota de vínculo não foi reconhecida (HTTP ${link.status}). ${reason}`);
  }

  const probe = await fetch(url, {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: '{}'
  }).catch(() => null);
  if (!probe) throw new Error('Não consegui acessar a rota do webhook.');
  const probeBody = await probe.json().catch(() => null);
  if (!probe.ok || probeBody?.ok !== true) {
    throw new Error(`O webhook respondeu HTTP ${probe.status}. ${explainStatus(probe.status)}`);
  }

  const registered = await telegram('setWebhook', {
    url, secret_token: secret, allowed_updates: ['message', 'callback_query'], max_connections: 1
  });
  if (registered !== true || (await telegram('getWebhookInfo')).url !== url) {
    throw new Error('Não foi possível verificar o registro do webhook no Telegram.');
  }
  console.log(`Webhook registrado e verificado: ${url}`);
}

(process.argv[2] === '--status' ? showStatus() : registerWebhook()).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
