/**
 * BioTime Cloud (ZKBio Time Cloud) API client — SERVER SIDE ONLY.
 *
 * This module must never be imported from anything under src/. It reads the BioTime
 * username/password from the environment; bundling it into the browser would publish
 * those credentials to every visitor. The browser talks to /api/biotime instead.
 *
 * API shape (BioTime 8.x / 9.x / Cloud share a lineage):
 *   POST /jwt-api-token-auth/            {username, password} -> {token}
 *   GET  /iclock/api/transactions/       ?start_time=&end_time=&page=&page_size=
 *   GET  /personnel/api/employees/       ?page=&page_size=
 * Authenticated with header `Authorization: JWT <token>`.
 */

export interface BiotimeConfig {
  baseUrl: string;
  username: string;
  password: string;
  /**
   * A token issued from the BioTime portal (Apps / System → API). When present,
   * the username/password login is skipped entirely.
   *
   * ZKBio Time Cloud tenants (the *.minervaiot.com generation) sit behind an nginx
   * that rejects POST to the classic /jwt-api-token-auth/ path, so on those a portal
   * token is the only way in. Probing a live tenant showed /iclock/api/transactions/
   * answering with a proper JSON 401 while every login path returned nginx HTML.
   */
  apiToken?: string;
  /** Header scheme for the token. 'JWT' (classic BioTime) or 'Token'/'Bearer'. */
  authScheme: string;
}

/** A single fingerprint punch, normalised away from BioTime's version-dependent field names. */
export interface BiotimePunch {
  id: string;
  empCode: string;
  empName: string;
  /** 'YYYY-MM-DD HH:mm:ss' in the tenant's local wall-clock time. Never converted to UTC. */
  punchTime: string;
  /** '0' = check-in, '1' = check-out, other codes = overtime/break variants. */
  punchState: string;
  terminal: string;
}

export interface BiotimeEmployee {
  empCode: string;
  name: string;
  department: string;
}

export type BiotimeEnv = Record<string, string | undefined>;

const REQUEST_TIMEOUT_MS = 25000;
const PAGE_SIZE = 500;
const MAX_PAGES = 200; // hard stop so a misbehaving `next` link can never loop forever

/**
 * Hosts this proxy is willing to call.
 *
 * The base URL can be supplied per-request by an admin, which without this list would
 * turn the proxy into a server-side request forgery tool: a caller could name an
 * internal address (cloud metadata, a private-network service) and read the response
 * back through us. Restricting to the BioTime vendor domains removes that entirely.
 *
 * BIOTIME_ALLOWED_HOSTS (comma-separated suffixes) extends this for self-hosted
 * installs; an operator-set BIOTIME_BASE_URL is trusted implicitly.
 */
const DEFAULT_ALLOWED_HOST_SUFFIXES = [
  'minervaiot.com',
  'zkbiotimecloud.com',
  'zkteco.com',
  'zkteco.eu',
  'zkteco.me',
];

function allowedSuffixes(env: BiotimeEnv): string[] {
  const extra = (env.BIOTIME_ALLOWED_HOSTS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const operatorHost = (() => {
    try {
      return new URL((env.BIOTIME_BASE_URL || '').trim()).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();

  return [...DEFAULT_ALLOWED_HOST_SUFFIXES, ...extra, ...(operatorHost ? [operatorHost] : [])];
}

/**
 * Rejects any base URL that is not plain HTTPS to an allowed BioTime host.
 * Throws BiotimeError so the failure surfaces to the admin as a normal message.
 */
export function assertSafeBaseUrl(baseUrl: string, env: BiotimeEnv): URL {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new BiotimeError(`"${baseUrl}" is not a valid address.`, 400);
  }

  if (parsed.protocol !== 'https:') {
    throw new BiotimeError('The BioTime address must start with https://', 400);
  }

  // Credentials embedded in the URL, or an explicit port, are not something a genuine
  // BioTime portal address needs and are common SSRF-bypass shapes.
  if (parsed.username || parsed.password) {
    throw new BiotimeError('The BioTime address must not contain a username or password.', 400);
  }

  const host = parsed.hostname.toLowerCase();
  const permitted = allowedSuffixes(env).some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );

  if (!permitted) {
    throw new BiotimeError(
      `"${host}" is not an allowed BioTime host. Expected an address such as ` +
        'https://itime.minervaiot.com. If you self-host BioTime, add its hostname to ' +
        'BIOTIME_ALLOWED_HOSTS.',
      400
    );
  }

  return parsed;
}

/**
 * Reads config from the environment. Returns null when unconfigured, which is a
 * normal state (device not connected yet) rather than an error.
 */
/** Credentials supplied per-request by the signed-in admin, overriding the environment. */
export interface BiotimeOverrides {
  baseUrl?: string;
  apiToken?: string;
  authScheme?: string;
}

/**
 * Builds the effective config. Per-request overrides win over environment variables.
 *
 * ZKBio Time Cloud session tokens expire, and there is no self-service permanent API key
 * in the portal. Requiring a redeploy on every expiry would make the feature unusable, so
 * the admin can supply a fresh token from inside the app and it is passed through here.
 */
export function readBiotimeConfig(
  env: BiotimeEnv,
  overrides: BiotimeOverrides = {}
): BiotimeConfig | null {
  const baseUrl = (overrides.baseUrl || env.BIOTIME_BASE_URL || '').trim().replace(/\/+$/, '');
  const username = (env.BIOTIME_USERNAME || '').trim();
  const password = (env.BIOTIME_PASSWORD || '').trim();
  const apiToken = (overrides.apiToken || env.BIOTIME_API_TOKEN || '').trim();
  const authScheme = (overrides.authScheme || env.BIOTIME_AUTH_SCHEME || 'JWT').trim();

  // A token alone is enough; so is a username/password pair.
  if (!baseUrl) return null;
  if (!apiToken && (!username || !password)) return null;

  return { baseUrl, username, password, apiToken, authScheme };
}

/** Login paths differ by generation; the first that answers with a token wins. */
const LOGIN_PATHS = ['/api/jwt-api-token-auth/', '/jwt-api-token-auth/'];

// Token is cached in module scope so a burst of requests logs in once. Serverless
// containers are recycled freely, so this is a best-effort cache, not state we rely on.
let cachedToken: { token: string; baseUrl: string; expiresAt: number } | null = null;

async function login(config: BiotimeConfig): Promise<string> {
  // A portal-issued token needs no login round-trip at all.
  if (config.apiToken) return config.apiToken;

  const now = Date.now();
  if (cachedToken && cachedToken.baseUrl === config.baseUrl && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const failures: string[] = [];

  for (const path of LOGIN_PATHS) {
    let res: Response;
    try {
      res = await fetch(`${config.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: config.username, password: config.password }),
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : 'network error'}`);
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      throw new BiotimeError(
        'BioTime rejected the username or password. Check BIOTIME_USERNAME / BIOTIME_PASSWORD, ' +
          'and confirm this account is allowed to use the API.',
        res.status
      );
    }

    if (res.status >= 300 && res.status < 400) {
      failures.push(`${path}: unexpected redirect`);
      continue;
    }

    // A 404/405, or an HTML body, means this path is not the login endpoint on this
    // tenant — try the next one rather than reporting a hard failure.
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('json')) {
      failures.push(`${path}: HTTP ${res.status} ${contentType || 'no content-type'}`);
      continue;
    }

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const token = String(json.token || json.access || json.access_token || '');
    if (!token) {
      failures.push(`${path}: no token in response`);
      continue;
    }

    // BioTime JWTs are typically valid for hours; refresh well inside that.
    cachedToken = { token, baseUrl: config.baseUrl, expiresAt: now + 30 * 60 * 1000 };
    return token;
  }

  throw new BiotimeError(
    'Could not log in to BioTime with a username and password. Newer ZKBio Time Cloud tenants ' +
      'block password login over the API — generate a token in the BioTime portal and set it as ' +
      `BIOTIME_API_TOKEN instead. Tried: ${failures.join(' | ')}`,
    502
  );
}

export class BiotimeError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'BiotimeError';
    this.status = status;
  }
}

/** Reads the first present key from a record. BioTime renames fields between versions. */
function pick(row: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      const nestedValue = nested.name ?? nested.dept_name ?? nested.emp_code ?? nested.id;
      if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') {
        return String(nestedValue);
      }
      continue;
    }
    return String(value);
  }
  return fallback;
}

/** Both `data` and `results` appear as the page-array key depending on version. */
function rowsOf(json: Record<string, unknown>): Record<string, unknown>[] {
  const candidate = json.data ?? json.results ?? json.rows;
  return Array.isArray(candidate) ? (candidate as Record<string, unknown>[]) : [];
}

async function getPaged(
  config: BiotimeConfig,
  token: string,
  path: string,
  params: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(`${config.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    url.searchParams.set('page', String(page));
    // Versions disagree on which of these caps the page; sending both is harmless.
    url.searchParams.set('page_size', String(PAGE_SIZE));
    url.searchParams.set('limit', String(PAGE_SIZE));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `${config.authScheme} ${token}`,
        Accept: 'application/json',
      },
      // A 3xx to an internal address would otherwise walk straight past the host
      // allowlist, so redirects are refused rather than followed.
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      throw new BiotimeError('BioTime attempted a redirect, which is not allowed.', 502);
    }

    if (res.status === 404) throw new BiotimeError(`Endpoint not found: ${path}`, 404);

    // A rejected token is the single most likely failure in day-to-day use, because
    // ZKBio Time Cloud session tokens expire. Say so plainly instead of leaking a
    // raw HTTP status the shop owner cannot act on.
    if (res.status === 401 || res.status === 403) {
      cachedToken = null;
      throw new BiotimeError(
        config.apiToken
          ? 'BioTime rejected the access token — it has most likely expired. Click "Connection" ' +
            'above and paste a fresh accessToken from your BioTime portal.'
          : 'BioTime rejected the credentials.',
        401
      );
    }

    if (!res.ok) {
      // The upstream body is deliberately not echoed back: if the destination were ever
      // something other than BioTime, relaying its response would leak it to the caller.
      throw new BiotimeError(
        `BioTime request to ${path} failed (HTTP ${res.status}).`,
        res.status
      );
    }

    const json = (await res.json()) as Record<string, unknown>;
    const rows = rowsOf(json);
    all.push(...rows);

    if (!json.next || rows.length === 0) break;
  }

  return all;
}

/**
 * Fetches punches in a window. The transactions path is misspelled in some editions of
 * ZKTeco's own manual, so both spellings are attempted before giving up — otherwise a
 * tenant on the other spelling silently reports "0 punches" forever.
 */
export async function fetchTransactions(
  config: BiotimeConfig,
  startTime: string,
  endTime: string
): Promise<BiotimePunch[]> {
  const token = await login(config);
  const params = { start_time: startTime, end_time: endTime };

  let rows: Record<string, unknown>[];
  try {
    rows = await getPaged(config, token, '/iclock/api/transactions/', params);
  } catch (error) {
    if (error instanceof BiotimeError && error.status === 404) {
      rows = await getPaged(config, token, '/iclock/api/transctions/', params);
    } else {
      throw error;
    }
  }

  return rows
    .map((row) => ({
      id: pick(row, ['id', 'transaction_id', 'pk']),
      empCode: pick(row, ['emp_code', 'employee_code', 'employee', 'pin', 'user_id']),
      empName: [pick(row, ['first_name']), pick(row, ['last_name'])].filter(Boolean).join(' ').trim(),
      punchTime: pick(row, ['punch_time', 'punch_state_time', 'time', 'checktime', 'upload_time']),
      punchState: pick(row, ['punch_state', 'state', 'check_type'], '0'),
      terminal: pick(row, ['terminal_alias', 'terminal_sn', 'device_name', 'source']),
    }))
    .filter((punch) => punch.empCode && punch.punchTime);
}

/**
 * Employee list. Best-effort: the path moved between generations and a live ZKBio Time
 * Cloud tenant served HTML for the classic one. Sync never depends on this — it takes
 * names from the punch payload — so an unreachable path returns an empty list rather
 * than failing the whole run.
 */
export async function fetchEmployees(config: BiotimeConfig): Promise<BiotimeEmployee[]> {
  const token = await login(config);
  const paths = ['/personnel/api/employees/', '/iclock/api/employees/', '/api/personnel/employees/'];

  let rows: Record<string, unknown>[] = [];
  for (const path of paths) {
    try {
      rows = await getPaged(config, token, path, {});
      if (rows.length > 0) break;
    } catch {
      // Try the next candidate path.
    }
  }

  return rows
    .map((row) => {
      const name = [pick(row, ['first_name', 'name']), pick(row, ['last_name'])]
        .filter(Boolean)
        .join(' ')
        .trim();
      const empCode = pick(row, ['emp_code', 'employee_code', 'pin']);
      return {
        empCode,
        name: name || pick(row, ['nickname']) || empCode,
        department: pick(row, ['department', 'dept_name']),
      };
    })
    .filter((employee) => employee.empCode);
}

export interface ProxyResult {
  status: number;
  body: unknown;
}

/**
 * Framework-agnostic request handler. Shared by the Vercel serverless function
 * (production) and the Vite dev-server middleware (local), so both run identical code.
 */
export async function handleBiotimeRequest(
  action: string,
  query: Record<string, string>,
  env: BiotimeEnv,
  overrides: BiotimeOverrides = {}
): Promise<ProxyResult> {
  const config = readBiotimeConfig(env, overrides);

  // Validate the destination before any outbound request is made.
  if (config) {
    try {
      assertSafeBaseUrl(config.baseUrl, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 400, body: { configured: true, connected: false, error: message } };
    }
  }

  if (!config) {
    // Not an error: the shop may not have connected BioTime yet. The UI shows a
    // "not connected" banner and every manual feature keeps working.
    return {
      status: 200,
      body: {
        configured: false,
        message:
          'BioTime is not connected. Use "Connect BioTime" on the Attendance page to paste your ' +
          'portal address and access token, or set BIOTIME_BASE_URL and BIOTIME_API_TOKEN in the environment.',
      },
    };
  }

  try {
    switch (action) {
      case 'status': {
        // Actually exercise a data endpoint. A portal token needs no login round-trip,
        // so "login succeeded" would otherwise prove nothing about whether it works.
        const probeEnd = new Date();
        const probeStart = new Date(probeEnd.getTime() - 24 * 60 * 60 * 1000);
        const fmt = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');
        await fetchTransactions(config, fmt(probeStart), fmt(probeEnd));
        return { status: 200, body: { configured: true, connected: true, baseUrl: config.baseUrl } };
      }
      case 'employees': {
        const employees = await fetchEmployees(config);
        return { status: 200, body: { configured: true, employees } };
      }
      case 'transactions': {
        const start = query.start || '';
        const end = query.end || '';
        if (!start || !end) {
          return { status: 400, body: { configured: true, error: 'start and end are required.' } };
        }
        const punches = await fetchTransactions(config, start, end);
        return { status: 200, body: { configured: true, punches } };
      }
      default:
        return { status: 400, body: { error: `Unknown action "${action}".` } };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof BiotimeError ? error.status : 502;
    return { status, body: { configured: true, connected: false, error: message } };
  }
}
