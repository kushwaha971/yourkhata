import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { API_PATHS } from 'src/api/APIPaths';
import { api, __resetTransportState } from 'src/api/AxiosInstances';
import { resetAllFeatureState } from 'src/redux/actions';
import { sessionExpired, sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';

import { selectUnreadCount } from 'modules/DigiKhaato/features/notifications/redux/notificationSlice';
import { fetchUnreadCount } from 'modules/DigiKhaato/features/notifications/redux/notificationThunk';

const originalAdapter = api.defaults.adapter;
const signIn = (id: string, version = 1, tenantId = 'same-shop') =>
  store.dispatch(
    sessionLoaded({
      user: {
        id,
        name: 'Radhe Krishna Enterprises operator',
        email: `${id}@shop.test`,
        mobile: null,
        locale: 'en',
        mustChangePassword: false,
        passwordExpiresAt: null,
      },
      activeTenant: {
        id: tenantId,
        name: 'Radhe Krishna Enterprises',
        timezone: 'Asia/Kolkata',
      },
      tenants: [{ id: tenantId, name: 'Radhe Krishna Enterprises', timezone: 'Asia/Kolkata' }],
      permissions: ['parties.party.read'],
      enabledModules: ['parties', 'notifications'],
      version,
    })
  );
const response = (
  config: InternalAxiosRequestConfig,
  count = 7,
  headers: Record<string, string> = {}
): AxiosResponse => ({
  data: { data: { count } },
  status: 200,
  statusText: 'OK',
  headers: { 'x-tenant-id': 'same-shop', ...headers },
  config,
});

beforeEach(() => {
  __resetTransportState();
  store.dispatch(resetAllFeatureState());
  signIn('operator-a');
});
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  store.dispatch(resetAllFeatureState());
  store.dispatch(sessionExpired());
  __resetTransportState();
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function heldRead() {
  let release: (value: AxiosResponse) => void = () => undefined,
    reject: (reason: unknown) => void = () => undefined;
  let sent: InternalAxiosRequestConfig | undefined,
    started: () => void = () => undefined;
  const issued = new Promise<void>((resolve) => {
    started = resolve;
  });
  const requests: string[] = [];
  api.defaults.adapter = (async (config) => {
    requests.push(config.url ?? '');
    if (sent)
      return response(config, 7, {
        'x-tenant-id': store.getState().session.activeTenant?.id ?? '',
      });
    sent = config;
    started();
    return new Promise((resolve, fail) => {
      release = resolve;
      reject = fail;
    });
  }) as AxiosAdapter;
  const pending = store.dispatch(fetchUnreadCount());
  await issued;
  const issuedConfig = sent;
  if (!issuedConfig) throw new Error('Request adapter was not reached');
  return {
    pending,
    requests,
    config: issuedConfig,
    reply: (headers: Record<string, string> = {}) => release(response(issuedConfig, 7, headers)),
    fail: (status: number, code: string) =>
      reject(
        new AxiosError('Test response', 'ERR_BAD_REQUEST', issuedConfig, undefined, {
          data: { error: { code, message: 'Test response' } },
          status,
          statusText: 'Error',
          headers: {},
          config: issuedConfig,
        })
      ),
  };
}

it('discards a late previous-user response after logout and another user signs into the same business', async () => {
  /** Tenant-only guards formerly let the first counter operator's private count populate the next operator. */
  const held = await heldRead();
  store.dispatch(sessionExpired());
  store.dispatch(resetAllFeatureState());
  signIn('operator-b');
  held.reply();
  await held.pending;
  expect(selectUnreadCount(store.getState())).toBeNull();
});

it('never refreshes or replays a previous users delayed 401 under the next account', async () => {
  /** A stale rejection must not borrow the next user's refresh cookie or replay an old intent. */
  const held = await heldRead();
  signIn('operator-b');
  held.fail(401, 'token_expired');
  await held.pending;
  expect(held.requests).not.toContain(API_PATHS.AUTH_REFRESH);
  expect(selectUnreadCount(store.getState())).toBeNull();
});

it('does not accept a response from an older permission revision', async () => {
  /** Revocation must not be undone by an already running read from previous rights. */
  const held = await heldRead();
  signIn('operator-a', 2);
  held.reply({ 'x-user-id': 'operator-a', 'x-membership-version': '1' });
  await held.pending;
  expect(selectUnreadCount(store.getState())).toBeNull();
});

it('sends actor and business preconditions from the authenticated context', async () => {
  /** Headers are stale-tab safety conditions, never authentication/tenant selection. */
  const held = await heldRead();
  held.reply();
  await held.pending;
  expect(held.config.headers.get('X-Expected-User-Id')).toBe('operator-a');
  expect(held.config.headers.get('X-Expected-Tenant-Id')).toBe('same-shop');
});

it('clears private state when the server rejects a changed cookie actor', async () => {
  /** A shared-cookie account change must not paint the new user's data below an old identity. */
  jest.useFakeTimers();
  const held = await heldRead();
  held.fail(409, 'session_context_changed');
  await held.pending;
  expect(store.getState().session.status).toBe('anonymous');
  expect(selectUnreadCount(store.getState())).toBeNull();
});

it('does not replay or end the new session when an older refresh finishes late', async () => {
  /** A refresh already running for A must not replay A's request or sign B out. */
  let finish: ((value: AxiosResponse) => void) | undefined;
  let refreshConfig: InternalAxiosRequestConfig | undefined;
  let started: () => void = () => undefined;
  const refreshing = new Promise<void>((resolve) => {
    started = resolve;
  });
  let reads = 0;
  api.defaults.adapter = (async (config) => {
    if (config.url === API_PATHS.AUTH_REFRESH) {
      refreshConfig = config;
      started();
      return new Promise((resolve) => {
        finish = resolve;
      });
    }
    reads += 1;
    if (reads === 1)
      throw new AxiosError('Expired', 'ERR_BAD_REQUEST', config, undefined, {
        data: { error: { code: 'token_expired' } },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
      });
    return response(config);
  }) as AxiosAdapter;
  const pending = store.dispatch(fetchUnreadCount());
  await refreshing;
  signIn('operator-b');
  if (!finish || !refreshConfig) throw new Error('Refresh was not reached');
  finish(response(refreshConfig));
  await pending;
  expect(reads).toBe(1);
  expect(store.getState().session.user?.id).toBe('operator-b');
  expect(store.getState().session.status).toBe('authenticated');
  expect(selectUnreadCount(store.getState())).toBeNull();
});

it('does not refresh or replay a stale business request even when the user is unchanged', async () => {
  /** One owner may use two firms; an old 401 must never replay a first-firm intent in the second. */
  jest.useFakeTimers();
  const held = await heldRead();
  signIn('operator-a', 1, 'other-shop');
  held.fail(401, 'token_expired');
  await held.pending;
  expect(held.requests).not.toContain(API_PATHS.AUTH_REFRESH);
  expect(selectUnreadCount(store.getState())).toBeNull();
});

it('drops previous-business data after the same user leaves every active business', async () => {
  /** Ending support/no-tenant transitions must not refill an unscoped workspace with old books. */
  const held = await heldRead();
  const session = store.getState().session;
  if (!session.user) throw new Error('User was not signed in');
  store.dispatch(
    sessionLoaded({
      user: session.user,
      activeTenant: null,
      tenants: session.tenants,
      permissions: [],
      enabledModules: [],
      version: null,
    })
  );
  held.reply();
  await held.pending;
  expect(selectUnreadCount(store.getState())).toBeNull();
});

it('keeps actor intent but permits session discovery to report no active business', async () => {
  /** Auth/me must remain usable after ending support or a no-tenant session transition. */
  let seen: InternalAxiosRequestConfig | undefined;
  api.defaults.adapter = (async (config) => {
    seen = config;
    return response(config);
  }) as AxiosAdapter;
  await api.get(API_PATHS.AUTH_ME);
  if (!seen) throw new Error('Session discovery was not sent');
  expect(seen.headers.get('X-Expected-User-Id')).toBe('operator-a');
  expect(seen.headers.get('X-Expected-Tenant-Id')).toBeUndefined();
});
