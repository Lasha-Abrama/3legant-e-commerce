import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createContext, runInContext } from 'vm';

describe('OAuth handoff with an in-flight header refresh', () => {
  it('waits for the rotated refresh cookie before navigating away', async () => {
    let finishRefresh!: (value: unknown) => void;
    const pending = new Promise(resolve => { finishRefresh = resolve; });
    const replace = jest.fn();
    const token = 'h.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 1200 })).toString('base64url') + '.s';
    const browser: any = createContext({ navigator: {}, Promise, Date, URL,
      atob: (value: string) => Buffer.from(value, 'base64').toString(),
      localStorage: { removeItem() {} }, sessionStorage: { removeItem() {} },
      document: { getElementById: () => ({ textContent: '', hidden: true }) },
      window: { location: { href: 'http://localhost:5001/oauth-callback.html', origin: 'http://localhost:5001', replace } },
      fetch: jest.fn((url: string) => url.endsWith('/refresh') ? pending : Promise.resolve({ status: 200, json: async () => ({ accessToken: token }) })),
    });
    runInContext(readFileSync(resolve(__dirname, '../../../Frontend/js/api.js'), 'utf8'), browser);
    browser.qs = () => null;
    // header.js starts this before oauth-callback.js runs.
    browser.refreshAccessToken();
    runInContext(readFileSync(resolve(__dirname, '../../../Frontend/js/oauth-callback.js'), 'utf8'), browser);
    await new Promise(resolve => setImmediate(resolve));
    expect(replace).not.toHaveBeenCalled();
    finishRefresh({ status: 200, ok: true, json: async () => ({ accessToken: token }) });
    await new Promise(resolve => setImmediate(resolve));
    expect(replace).toHaveBeenCalledWith('account.html');
  });
});
