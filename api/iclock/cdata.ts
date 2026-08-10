/**
 * ADMS endpoint for the ZKTeco fingerprint terminal — Vercel serverless function.
 *
 * Serves /iclock/cdata, /iclock/getrequest and /iclock/devicecmd; all three are rewritten
 * here by vercel.json, because the device's paths are fixed in firmware and cannot be
 * pointed at /api/*.
 *
 * Thin adapter only — every protocol and database decision lives in _deviceIngest.ts, so
 * the Vite dev server (for LAN testing) and scripts/simulate-device.ts run the identical
 * code path.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { decodeBody, defaultConfig, handleDeviceRequest } from '../_deviceIngest.js';

/**
 * `_firebaseAdmin` is imported dynamically, inside the try block below, on purpose.
 *
 * It pulls in `firebase-admin`, and a module-load failure there — a dependency missing from
 * the deployment, a bad build — happens before any handler code runs, so a static import
 * would crash the whole function with a 500 that no try/catch can reach. The device reads a
 * 500 as "delivery failed" and retries in a loop. Loading it lazily turns that class of
 * failure into a logged error and a well-formed `OK`.
 *
 * `_deviceIngest` above is safe to import statically: it is deliberately dependency-free.
 */

// Structurally typed to avoid a hard dependency on @vercel/node.
interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/** Hard cap so a device sending a wrong Content-Length cannot exhaust the function. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function sendText(res: ServerResponse, body: string): void {
  const payload = Buffer.from(body, 'utf8');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Length', String(payload.length));
  // Punch traffic must never be served from a CDN cache.
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

/**
 * Reads the body as raw bytes.
 *
 * `req.body` is not trusted: the device sends Content-Type: text/plain, or nothing, or
 * something wrong, and what the platform hands back for those varies between string,
 * Buffer and undefined. The stream is read directly while it is still readable, and
 * req.body is only the fallback for when the runtime already consumed it.
 */
async function readRawBody(req: VercelRequest): Promise<Buffer> {
  if (!req.readableEnded) {
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for await (const chunk of req) {
        const buffer = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : (chunk as Buffer);
        total += buffer.length;
        if (total > MAX_BODY_BYTES) break;
        chunks.push(buffer);
      }
    } catch {
      // Fall through to req.body rather than failing the punch.
    }
    if (chunks.length > 0) return Buffer.concat(chunks);
  }

  const body = req.body;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  return Buffer.alloc(0);
}

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', 'http://device.local');

  // Parsed from the URL rather than req.query so this behaves identically under any runtime.
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const method = (req.method || 'GET').toUpperCase();
  const bodyBuffer = method === 'GET' ? Buffer.alloc(0) : await readRawBody(req);

  const headers: Record<string, string> = {};
  for (const name of ['user-agent', 'content-type', 'content-length', 'host']) {
    const value = req.headers[name];
    if (value !== undefined) headers[name] = String(value);
  }

  try {
    const { getDeviceStore } = await import('../_firebaseAdmin.js');
    const store = getDeviceStore();
    const result = await handleDeviceRequest(
      {
        method,
        // The rewrite hides the original path, so normalise back to the device's own.
        path: url.pathname.replace(/^\/api/, ''),
        query,
        body: decodeBody(bodyBuffer),
        bodyBytes: bodyBuffer.length,
        headers,
        remoteAddress:
          String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
          req.socket?.remoteAddress ||
          '',
      },
      store,
      defaultConfig(process.env)
    );

    if (result.log) console.log(`[iclock] ${result.log}`);
    sendText(res, result.body);
  } catch (error) {
    // Compared by name rather than instanceof: the class now lives behind a dynamic import,
    // and if that import is what failed there is no class to compare against.
    if ((error as Error)?.name === 'AdminConfigError') {
      console.error(`[iclock] ${(error as Error).message}`);
    } else {
      console.error('[iclock] Unhandled failure:', error);
    }

    // Still answer OK. The device retries forever on anything else, and a retry storm is
    // worse than a punch we can recover from the logs.
    sendText(res, 'OK');
  }
}
