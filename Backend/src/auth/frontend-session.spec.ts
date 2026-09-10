import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createContext, runInContext } from 'vm';

describe('Browser silent refresh', () => {
  let browser: any;
  const token = (seconds: number) => 'header.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url') + '.signature';
  const reply = (status: number, data = {}) => ({ status, ok: status < 400, json: async () => data });
  beforeEach(() => {
    browser = createContext({ navigator: {}, fetch: jest.fn(), Date, Promise,
      atob: (value: string) => Buffer.from(value, 'base64').toString(),
      localStorage: { removeItem: jest.fn(), setItem: jest.fn() },
      sessionStorage: { removeItem: jest.fn(), setItem: jest.fn() } });
    runInContext(readFileSync(resolve(__dirname, '../../../Frontend/js/api.js'), 'utf8'), browser);
  });
  it('keeps access tokens in memory and removes legacy storage', () => {
    browser.setAccessToken(token(1200));
    expect(browser.localStorage.removeItem).toHaveBeenCalledWith('threelegant_access_token');
    expect(browser.sessionStorage.removeItem).toHaveBeenCalledWith('threelegant_access_token');
    expect(browser.localStorage.setItem).not.toHaveBeenCalled();
    expect(browser.sessionStorage.setItem).not.toHaveBeenCalled();
  });
  it('shares one silent refresh across concurrent requests', async () => {
    browser.fetch.mockImplementation(async (url: string) => url.endsWith('/refresh')
      ? reply(200, { accessToken: token(1200) }) : reply(200));
    await Promise.all([browser.authenticatedFetch('/orders'), browser.authenticatedFetch('/users/me/wishlist')]);
    expect(browser.fetch.mock.calls.filter(([url]: [string]) => url.endsWith('/refresh'))).toHaveLength(1);
  });
  it('refreshes an almost expired token before requesting the current user', async () => {
    browser.setAccessToken(token(30));
    browser.fetch.mockResolvedValueOnce(reply(200, { accessToken: token(1200) })).mockResolvedValueOnce(reply(200));
    await browser.authenticatedFetch('/auth/me');
    expect(browser.fetch.mock.calls[0][0]).toBe('/api/auth/refresh');
  });
  it('refreshes and retries a 401 once with the new bearer token', async () => {
    browser.setAccessToken(token(1200));
    const replacement = token(1500);
    browser.fetch.mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(200, { accessToken: replacement })).mockResolvedValueOnce(reply(200));
    expect((await browser.authenticatedFetch('/orders')).status).toBe(200);
    expect(browser.fetch).toHaveBeenCalledTimes(3);
    expect(browser.fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer ' + replacement);
  });
  it('clears memory and stops retrying when the refresh session was revoked', async () => {
    browser.setAccessToken(token(1200));
    browser.fetch.mockResolvedValue(reply(401));
    expect((await browser.authenticatedFetch('/orders')).status).toBe(401);
    expect(browser.fetch).toHaveBeenCalledTimes(2);
    expect(browser.accessToken).toBe('');
  });
});
