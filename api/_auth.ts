/**
 * Firebase ID-token verification for the serverless proxy — SERVER SIDE ONLY.
 *
 * /api/biotime would otherwise be an unauthenticated endpoint that reaches out to a
 * caller-named host with the shop's BioTime credentials attached. Every request must
 * therefore prove it comes from a signed-in admin of THIS Firebase project.
 *
 * Verification is done against Google's public signing certificates rather than the
 * Firebase Admin SDK, so no service-account key has to be created, stored or rotated.
 */
import crypto from 'node:crypto';

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const DEFAULT_PROJECT_ID = 'swetha-couture';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export function projectIdFrom(env: Record<string, string | undefined>): string {
  return (env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID).trim();
}

let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function fetchSigningCerts(): Promise<Record<string, string>> {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.certs;

  const res = await fetch(CERT_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new AuthError('Could not fetch Google signing certificates.', 503);

  const certs = (await res.json()) as Record<string, string>;

  // Honour Google's own cache lifetime; fall back to an hour.
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAge = Number(/max-age=(\d+)/.exec(cacheControl)?.[1] ?? 3600);

  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };
  return certs;
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/**
 * Verifies a Firebase ID token's signature, issuer, audience and expiry.
 * Returns the user's uid. Throws AuthError on any failure.
 */
export async function verifyIdToken(idToken: string, projectId: string): Promise<string> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new AuthError('Malformed ID token.');

  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeSegment(headerSegment);
    payload = decodeSegment(payloadSegment);
  } catch {
    throw new AuthError('Malformed ID token.');
  }

  if (header.alg !== 'RS256') throw new AuthError('Unexpected token algorithm.');

  const certs = await fetchSigningCerts();
  const cert = certs[String(header.kid)];
  if (!cert) throw new AuthError('Unknown token signing key.');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerSegment}.${payloadSegment}`);
  const signatureValid = verifier.verify(cert, Buffer.from(signatureSegment, 'base64url'));
  if (!signatureValid) throw new AuthError('Token signature is not valid.');

  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) <= now) throw new AuthError('Token has expired.');
  if (Number(payload.iat) > now + 300) throw new AuthError('Token issued in the future.');
  if (payload.aud !== projectId) throw new AuthError('Token was issued for another project.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError('Token has an unexpected issuer.');
  }

  const uid = String(payload.sub || '');
  if (!uid) throw new AuthError('Token has no subject.');
  return uid;
}

// Role lookups are cached briefly: the attendance page polls once a minute, and a
// Firestore round-trip per poll per admin is pure overhead.
const roleCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();
const ROLE_TTL_MS = 5 * 60 * 1000;

/**
 * Confirms the user's `users/{uid}` document has role 'admin'.
 *
 * Read through the Firestore REST API using the caller's own ID token, so this respects
 * the project's security rules and needs no elevated service-account credentials.
 */
export async function assertAdmin(
  idToken: string,
  uid: string,
  projectId: string
): Promise<void> {
  const cached = roleCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.isAdmin) throw new AuthError('Admin access required.', 403);
    return;
  }

  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/users/${encodeURIComponent(uid)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new AuthError('Could not verify your role.', 403);

  const document = (await res.json()) as {
    fields?: { role?: { stringValue?: string } };
  };
  const isAdmin = document.fields?.role?.stringValue === 'admin';

  roleCache.set(uid, { isAdmin, expiresAt: Date.now() + ROLE_TTL_MS });
  if (!isAdmin) throw new AuthError('Admin access required.', 403);
}

/** Full check: valid ID token for this project, belonging to an admin. */
export async function requireAdmin(
  authorizationHeader: string,
  env: Record<string, string | undefined>
): Promise<string> {
  const match = /^Bearer\s+(.+)$/i.exec((authorizationHeader || '').trim());
  if (!match) throw new AuthError('Sign-in required.');

  const projectId = projectIdFrom(env);
  const uid = await verifyIdToken(match[1], projectId);
  await assertAdmin(match[1], uid, projectId);
  return uid;
}
