import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('Refresh session security', () => {
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  let users: any;
  let response: any;
  let auth: AuthService;
  beforeEach(() => {
    users = { findById: jest.fn().mockResolvedValue({ _id: 'user', tokenVersion: 7 }),
      addRefreshSession: jest.fn(), rotateRefreshSession: jest.fn(), toSafeUser: jest.fn().mockReturnValue({ id: 'user' }) };
    response = { cookie: jest.fn(), setHeader: jest.fn(), clearCookie: jest.fn() };
    auth = new AuthService(users, { signAsync: jest.fn().mockResolvedValue('access') } as never,
      { get: () => 'production', getOrThrow: () => 'https://store.example' } as never, {} as never);
  });
  it('stores only a hash and sends the secret in a secure HttpOnly SameSite cookie', async () => {
    await auth.establishSession('user', response);
    const [name, token, options] = response.cookie.mock.calls[0];
    expect(name).toBe('threelegant_refresh');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth' });
    expect(users.addRefreshSession).toHaveBeenCalledWith('user', 7, hash(token), options.expires);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
  it('rotates the cookie, passes only hashes to persistence, and keeps the original expiry', async () => {
    const expiresAt = new Date(Date.now() + 100000);
    users.rotateRefreshSession.mockResolvedValue({ user: { _id: 'user', tokenVersion: 7 }, expiresAt });
    const oldToken = 'a'.repeat(43);
    await expect(auth.refresh(oldToken, response)).resolves.toEqual({ accessToken: 'access', user: { id: 'user' } });
    const replacement = response.cookie.mock.calls[0][1];
    expect(replacement).not.toBe(oldToken);
    expect(users.rotateRefreshSession).toHaveBeenCalledWith(hash(oldToken), hash(replacement));
    expect(response.cookie.mock.calls[0][2].expires).toBe(expiresAt);
  });
  it('rejects cross-origin refresh requests before using a cookie', () => {
    expect(() => auth.validateSessionRequest({ headers: { origin: 'https://attacker.example',
      'x-requested-with': 'threelegant' } } as never)).toThrow('Invalid session request');
    expect(() => auth.validateSessionRequest({ headers: {} } as never)).toThrow('Invalid session request');
    expect(() => auth.validateSessionRequest({ headers: { origin: 'https://store.example',
      'x-requested-with': 'threelegant' } } as never)).not.toThrow();
  });
  it('atomically rotates only an unexpired current token', async () => {
    const user = { refreshSessions: [{ hash: 'replacement', expiresAt: new Date() }] };
    const model = { findOneAndUpdate: jest.fn().mockReturnValue({ select: () => ({ exec: async () => user }) }) };
    const service = new UsersService(model as never, {} as never);
    await service.rotateRefreshSession('old', 'replacement');
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ refreshSessions: {
      $elemMatch: { hash: 'old', expiresAt: { $gt: expect.any(Date) }, 'previousHashes.2047': { $exists: false } },
    } }), { $set: { 'refreshSessions.$.hash': 'replacement' }, $push: { 'refreshSessions.$.previousHashes': 'old' } }, { returnDocument: 'after' });
  });
  it('revokes the refresh family when an old token is replayed', async () => {
    const model = { findOneAndUpdate: jest.fn().mockReturnValue({ select: () => ({ exec: async () => null }) }),
      updateOne: jest.fn().mockReturnValue({ exec: async () => ({}) }) };
    const service = new UsersService(model as never, {} as never);
    await expect(service.rotateRefreshSession('replayed', 'replacement')).rejects.toThrow('session has expired');
    expect(model.updateOne).toHaveBeenCalledWith({ 'refreshSessions.previousHashes': 'replayed' },
      { $pull: { refreshSessions: { previousHashes: 'replayed' } } });
  });
});
