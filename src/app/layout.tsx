import type { Metadata } from 'next';
import { PrimeReactProvider } from 'primereact/api';
import './globals.css';

export const metadata: Metadata = {
  title: 'Economizaê — Gestão Financeira Pessoal',
  description:
    'Gerencie suas Entradas no mês, Saídas pagas e Contas a Pagar (saídas pendentes) com PrimeReact e Supabase.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <PrimeReactProvider value={{ ripple: true }}>
          {children}
        </PrimeReactProvider>
      </body>
    </html>
  );
}
