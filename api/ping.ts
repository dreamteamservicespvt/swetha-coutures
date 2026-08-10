/**
 * Diagnostic endpoint. Reveals nothing sensitive and touches no data.
 *
 * Exists to answer, without access to the Vercel dashboard, why an api/ route is failing:
 * is the serverless runtime itself working, are the environment variables visible, and can
 * the function actually load firebase-admin? A route that returns a bare "OK" when it
 * should return real content is usually one of those three.
 *
 * Safe to leave deployed. Error messages are truncated and no secret is ever echoed.
 */
export default async function handler(_req: unknown, res: any) {
  const { normalisePrivateKey } = await import('./_firebaseAdmin.js').catch(() => ({
    normalisePrivateKey: (raw: string) => raw,
  }));
  const normalised = normalisePrivateKey(process.env.FIREBASE_PRIVATE_KEY || '');

  const lines: string[] = [
    'pong',
    `node=${process.version}`,
    `firebase_project_id=${process.env.FIREBASE_PROJECT_ID ? 'SET' : 'MISSING'}`,
    `firebase_client_email=${process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'MISSING'}`,
    `firebase_private_key=${process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'MISSING'}`,
    // A key pasted with the surrounding quotes, or with its newlines flattened, is the
    // single most common reason credentials that "look right" fail to parse.
    `private_key_length=${(process.env.FIREBASE_PRIVATE_KEY || '').length}`,
    `private_key_raw_starts_correctly=${(process.env.FIREBASE_PRIVATE_KEY || '').trimStart().startsWith('-----BEGIN')}`,
    `private_key_after_cleanup_ok=${normalised.startsWith('-----BEGIN') && normalised.endsWith('-----')}`,
  ];

  const probe = async (label: string, load: () => Promise<unknown>) => {
    try {
      await load();
      lines.push(`${label}=OK`);
    } catch (error) {
      lines.push(`${label}=FAILED: ${(error as Error)?.message?.slice(0, 300)}`);
    }
  };

  await probe('import_firebase_admin_app', () => import('firebase-admin/app'));
  await probe('import_firebase_admin_firestore', () => import('firebase-admin/firestore'));
  await probe('import_local_deviceIngest', () => import('./_deviceIngest.js'));
  await probe('import_local_firebaseAdmin', () => import('./_firebaseAdmin.js'));

  // The real thing: can we actually build an authenticated Firestore handle?
  await probe('build_firestore_store', async () => {
    const { getDeviceStore } = await import('./_firebaseAdmin.js');
    getDeviceStore();
  });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(lines.join('\n') + '\n');
}
