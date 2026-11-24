# Economizaê — Gestão Financeira Pessoal

Aplicativo web responsivo construído com **Next.js (App Router)**, **TypeScript**, **PrimeReact**, **PrimeIcons**, **PrimeFlex** e **Supabase (PostgreSQL + Auth RLS)**.

## Funcionalidades Principais

- **Visão Mensal Completa**:
  - **Entradas no Mês**: Total previsto, valor já recebido e valor a receber.
  - **Saídas Pagas**: Despesas efetivamente quitadas no mês.
  - **Contas a Pagar (Saídas Pendentes)**: Lista dedicada ordenada por vencimento, com alertas automáticos de contas **Vencidas**, **Vencendo Hoje** e **A Vencer**, além de botão **"Pagar"** em 1 clique.
  - **Duplo Indicador de Saldo**:
    - **Saldo Real em Caixa**: acumulado de recebimentos e pagamentos desde o último saldo informado, com transporte de sobras e déficits entre meses. Use **Editar saldo real** para informar o valor em caixa ao fim de uma data.
    - **Saldo Previsto no Fim do Mês**: saldo real acrescido das entradas pendentes e descontado das despesas pendentes do mês selecionado.
- **Recorrência e Parcelamentos**:
  - Lançamentos **Únicos**, **Fixos Mensais** (12 meses) e **Parcelados** (`2x` a `60x`, com opção de registrar no histórico parcelas já pagas).
- **Gráficos Interativos (`PrimeReact Chart` / `Chart.js`)**:
  - Rosca de Despesas por Categoria (detalhando Pago vs. Pendente) e Barras de Fluxo Mensal.
- **Contas individuais**. Cada pessoa entra com e-mail e senha e acessa seus dados no Supabase.

## Como Executar

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Executar testes unitários
npm test
```

Acesse `http://localhost:3000` no navegador.

## Configurando o Supabase

1. No SQL Editor do Supabase, execute [supabase/schema.sql](./supabase/schema.sql) em um banco novo. Para um banco que já recebeu o schema anterior, aplique as atualizações que ainda faltam: [supabase/account-access.sql](./supabase/account-access.sql) para o login e [supabase/balance-adjustments.sql](./supabase/balance-adjustments.sql) para o saldo acumulado.
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Use a chave pública Publishable ou a chave `anon` legada.
3. Para publicar na Vercel, configure as mesmas variáveis em **Production** antes do deploy.
4. No Supabase Auth, habilite o cadastro por e-mail e **Confirm email**, defina a **Site URL** como a URL de produção e configure SMTP para enviar confirmações a usuários externos.

Após publicar, teste o cadastro e a confirmação de e-mail. Crie um lançamento, entre com a mesma conta em outra janela e confira se o lançamento aparece. Saia e entre com uma segunda conta no mesmo navegador para verificar o isolamento.

Ao abrir a nova versão na mesma origem, o navegador remove os antigos dados financeiros de teste do Modo Local. Os registros do Supabase são preservados.

## Ativando o Telegram com Gemini

1. Aplique [supabase/telegram.sql](./supabase/telegram.sql) no SQL Editor do Supabase depois de configurar o esquema principal.
2. No ambiente do servidor, configure `TELEGRAM_BOT_TOKEN` (do BotFather), `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `TELEGRAM_WEBHOOK_SECRET`. Gere um segredo exclusivo para o webhook com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. `GEMINI_MODEL` é opcional e usa `gemini-3.1-flash-lite` por padrão. Essas variáveis são privadas. Para usar o plano gratuito do Gemini, use uma chave de um projeto sem faturamento ativo e com cota disponível para o modelo.
3. Publique a aplicação com essas variáveis. Com o mesmo token do bot e o mesmo segredo do webhook disponíveis no ambiente do terminal, registre o webhook na URL pública da aplicação. Se você guardou as variáveis em `.env.local`, use Node.js 20.6 ou mais recente e rode:

   ```bash
   node --env-file=.env.local scripts/set-telegram-webhook.mjs https://seu-app.vercel.app
   ```

   Se as variáveis já estiverem exportadas no terminal, rode o mesmo comando sem `--env-file=.env.local`.
4. No Economizaê, vá a **Telegram → Vincular Telegram → Abrir bot no Telegram**. Toque em **Iniciar** no bot e volte ao site para escolher **Verificar vínculo**.
5. Envie `-25 corte de cabelo`, confira o resumo e toque em **Confirmar**. O painel mostra o lançamento ao voltar à aba ou atualizar a página. Para registrar só a parcela atual e as seguintes, envie uma mensagem como `R$ 120 por parcela da geladeira, parcela 3 de 10 no Nubank, vence em 10/12 e ainda não paguei`.

O bot atende em conversas individuais vinculadas e pede confirmação antes de qualquer lançamento. **Desvincular Telegram** invalida os rascunhos daquele chat. Mensagens financeiras são processadas pelo Gemini, e o Google pode usar o texto para melhorar seus produtos no plano gratuito.
