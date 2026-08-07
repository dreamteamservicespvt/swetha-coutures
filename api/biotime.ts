/**
 * Vercel serverless function: GET /api/biotime?action=status|employees|transactions
 *
 * Thin adapter only — all logic lives in _biotimeCore so the Vite dev middleware
 * can run exactly the same code path locally.
 */
import { handleBiotimeRequest } from './_biotimeCore';
import { AuthError, requireAdmin } from './_auth';

// Structurally typed to avoid a hard dependency on @vercel/node.
interface VercelRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}
interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  // This endpoint reaches an external host carrying the shop's BioTime credentials and
  // returns staff attendance data. It must never be callable anonymously.
  try {
    await requireAdmin(firstValue(req.headers.authorization), process.env);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 401;
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json({
      error: error instanceof Error ? error.message : 'Sign-in required.',
    });
    return;
  }

  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query || {})) {
    query[key] = firstValue(value);
  }

  // Credentials travel in headers, never the query string, so they cannot end up in
  // access logs or browser history.
  const overrides = {
    baseUrl: firstValue(req.headers['x-biotime-base-url']),
    apiToken: firstValue(req.headers['x-biotime-token']),
    authScheme: firstValue(req.headers['x-biotime-scheme']),
  };

  const result = await handleBiotimeRequest(
    query.action || 'status',
    query,
    process.env,
    overrides
  );

  // Punch data is per-tenant and changes constantly; never let a CDN hold it.
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.status).json(result.body);
}
