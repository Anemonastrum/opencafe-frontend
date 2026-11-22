export class ApiError extends Error {
  constructor(message, status = 0, code) { super(message); this.status = status; this.code = code; }
}
const browserLock = (name, run) => globalThis.navigator?.locks ? navigator.locks.request(name, run) : run();
export function createClient({ fetchImpl = (...args) => fetch(...args), lock = browserLock, onSession } = {}) {
  let token = null, generation = 0, refreshFlight, restoration;
  let state = { status: 'loading', user: null, error: null, generation };
  const listeners = new Set();
  const emit = (next) => { state = { ...state, ...next, generation }; onSession?.(state); listeners.forEach(fn => fn()); };
  const invalidate = (next, keepToken = false) => { ++generation; if (!keepToken) token = null; emit(next); };
  const check = expected => { if (expected !== generation) throw new ApiError('Session changed', 0, 'SESSION_CHANGED'); };
  async function raw(path, { method = 'GET', body, signal, response = 'json', accessToken } = {}) {
    const headers = new Headers({ Accept: response === 'json' ? 'application/json' : '*/*' });
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    if (body !== undefined && !(body instanceof FormData)) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(body); }
    const res = await fetchImpl(path, { method, body, headers, signal, credentials: 'same-origin', cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (!res.ok) {
      const data = type.includes('application/json') ? await res.json().catch(() => ({})) : {};
      throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data.code);
    }
    if (response === 'blob') return { blob: await res.blob(), type };
    return res.status === 204 ? null : res.json();
  }
  async function accept(data, expected, previousUser) {
    check(expected);
    if (!data?.accessToken || !data.user) throw new ApiError('Invalid session response');
    const me = await raw('/api/auth/me', { accessToken: data.accessToken });
    check(expected);
    if (!me?.user || me.user.id !== data.user.id) throw new ApiError('Invalid current user');
    if (previousUser && (me.user.id !== previousUser.id || me.user.role !== previousUser.role || (!previousUser.mustChangePassword && me.user.mustChangePassword))) {
      invalidate({ status: 'anonymous', user: null, error: new ApiError('Session changed. Sign in again.', 401) });
      check(expected);
    }
    token = data.accessToken; emit({ status: 'authenticated', user: me.user, error: null });
    return me.user;
  }
  function refresh(expected = generation) {
    if (refreshFlight?.generation === expected) return refreshFlight.promise;
    const previousUser = state.user;
    const promise = lock('opencafe-auth', async () => {
      check(expected);
      const data = await raw('/api/auth/refresh', { method: 'POST' });
      check(expected);
      return data;
    }).then(data => accept(data, expected, previousUser)).catch(error => {
      if (expected === generation) invalidate({ status: error.status === 401 ? 'anonymous' : 'error', user: null, error });
      throw error;
    }).finally(() => { if (refreshFlight?.promise === promise) refreshFlight = null; });
    refreshFlight = { generation: expected, promise }; return promise;
  }
  async function request(path, options = {}) {
    if (!path.startsWith('/api/')) throw new ApiError('Invalid API path');
    const expected = generation, used = token;
    if (!used) throw new ApiError('Sign in required', 401);
    try {
      let result;
      try { result = await raw(path, { ...options, accessToken: used }); }
      catch (error) {
        check(expected);
        if (error.status !== 401 || options.refresh === false) throw error;
        if (token === used) await refresh(expected);
        check(expected);
        result = await raw(path, { ...options, accessToken: token });
      }
      check(expected); return result;
    } catch (error) {
      check(expected);
      if (error.code === 'PASSWORD_CHANGE_REQUIRED') invalidate({ user: { ...state.user, mustChangePassword: true } }, true);
      else if (error.status === 403) invalidate({ status: 'error', user: null, error: new ApiError('Access changed. Restore session to verify current permissions.',403) });
      else if (error.status === 401 && options.refresh !== false) invalidate({ status: 'anonymous', user: null, error });
      throw error;
    }
  }
  return {
    getSession: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    updateUser: user => { if (state.user?.id === user.id) emit({ user }); },
    restore() {
      if (!restoration) { const expected = generation; emit({ status: 'loading', error: null }); restoration = refresh(expected).catch(() => {}).finally(() => { restoration = null; }); }
      return restoration;
    },
    async login(username, password) {
      const expected = ++generation; token = null; emit({ status: 'anonymous', user: null, error: null });
      try { const data = await lock('opencafe-auth', () => raw('/api/auth/login', { method: 'POST', body: { username, password } })); return await accept(data, expected); }
      catch (error) { if (expected === generation) emit({ status: 'anonymous', user: null, error }); throw error; }
    },
    async logout() {
      ++generation; token = null; emit({ status: 'anonymous', user: null, error: null });
      try { await lock('opencafe-auth', () => raw('/api/auth/logout', { method: 'POST' })); }
      catch { throw new ApiError('Local session cleared. Server sign out unconfirmed; retry revocation.',503); }
    },
    async changePassword(currentPassword, newPassword) {
      await request('/api/auth/password', { method: 'PUT', body: { currentPassword, newPassword }, refresh: false });
      ++generation; token = null; emit({ status: 'anonymous', user: null, error: null });
    },
    request,
  };
}
export const client = createClient();
export const apiRequest = (...args) => client.request(...args);
