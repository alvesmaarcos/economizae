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
