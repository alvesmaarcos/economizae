# Economizaê — Gestão Financeira Pessoal

Aplicativo web responsivo construído com **Next.js (App Router)**, **TypeScript**, **PrimeReact**, **PrimeIcons**, **PrimeFlex** e **Supabase (PostgreSQL + Auth RLS)** com fallback automático para armazenamento local.

## Funcionalidades Principais

- **Visão Mensal Completa**:
  - **Entradas no Mês**: Total previsto, valor já recebido e valor a receber.
  - **Saídas Pagas**: Despesas efetivamente quitadas no mês.
  - **Contas a Pagar (Saídas Pendentes)**: Lista dedicada ordenada por vencimento, com alertas automáticos de contas **Vencidas**, **Vencendo Hoje** e **A Vencer**, além de botão **"Pagar"** em 1 clique.
  - **Duplo Indicador de Saldo**:
    - **Saldo Atual em Caixa**: `Entradas Recebidas − Saídas Pagas`
    - **Saldo Previsto no Fim do Mês**: `Total de Entradas − Total de Saídas (Pagas + Contas a Pagar)`
- **Recorrência e Parcelamentos**:
  - Lançamentos **Únicos**, **Fixos Mensais** (12 meses) e **Parcelados** (`2x` a `60x`, gerando automaticamente as parcelas nos meses seguintes).
- **Gráficos Interativos (`PrimeReact Chart` / `Chart.js`)**:
  - Rosca de Despesas por Categoria (detalhando Pago vs. Pendente) e Barras de Fluxo Mensal.
- **Modo Híbrido (Supabase Cloud + LocalStorage Fallback)**:
  - Funciona imediatamente no navegador sem exigir configuração prévia e sincroniza na nuvem assim que as chaves do Supabase são adicionadas ao `.env.local`.

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

## Configurando o Supabase (Opcional)

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No painel do Supabase, abra o **SQL Editor** e execute o conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql).
3. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
