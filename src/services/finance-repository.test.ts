import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createFinanceRepository } from '@/services/finance-repository';

function mockClient(fetch: typeof globalThis.fetch) {
  return createClient('https://economizae.test', 'public-test-key', {
    accessToken: async () => 'test-session-token',
    global: { fetch }
  });
}

describe('financeRepository', () => {
  it('scopes requests to the account that opened the dashboard', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json([])
    );
    const client = mockClient(fetch);
    const firstAccount = createFinanceRepository(client, 'first-account');
    const secondAccount = createFinanceRepository(client, 'second-account');

    await firstAccount.listTransactionsByMonth('2026-11');
    await secondAccount.listTransactionsByMonth('2026-11');
    await firstAccount.payCardInvoice('card-id', '2026-11');

    const filters = fetch.mock.calls.map(([url]) => new URL(String(url)).searchParams);
    expect(filters.map((filter) => filter.get('user_id'))).toEqual([
      'eq.first-account',
      'eq.second-account',
      'eq.first-account'
    ]);
    expect(filters[2].get('card_id')).toBe('eq.card-id');
  });

  it('reports cloud errors without returning local data or trying to reseed', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ message: 'Permission denied' }, { status: 403 })
    );
    const repository = createFinanceRepository(mockClient(fetch), 'account');

    await expect(repository.listCategories()).rejects.toThrow('Permission denied');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
