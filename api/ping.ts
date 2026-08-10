/**
 * Diagnostic endpoint. No imports, no dependencies, no database.
 *
 * Exists to answer one question when an api/ route returns FUNCTION_INVOCATION_FAILED:
 * is the Vercel serverless runtime itself working, or is the fault in what a function
 * imports? If /api/ping fails too, nothing about the failure is specific to that route —
 * it is the build or runtime configuration.
 *
 * Safe to leave deployed: it reveals nothing and touches nothing.
 */
export default function handler(_req: unknown, res: any) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    `pong\nnode=${process.version}\nruntime-ok=true\n` +
      `firebase_project_id=${process.env.FIREBASE_PROJECT_ID ? 'SET' : 'MISSING'}\n` +
      `firebase_client_email=${process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'MISSING'}\n` +
      `firebase_private_key=${process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'MISSING'}\n`
  );
}
