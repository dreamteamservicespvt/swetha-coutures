import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { handleBiotimeRequest, type BiotimeEnv } from "./api/_biotimeCore";
import { AuthError, requireAdmin } from "./api/_auth";

/**
 * Serves /api/biotime during `npm run dev`.
 *
 * In production Vercel runs api/biotime.ts as a serverless function, but the Vite dev
 * server knows nothing about the api/ directory — without this the feature would only
 * be testable after a deploy. Both paths call the same handleBiotimeRequest.
 *
 * `env` here is read server-side and is never handed to `define`, so the BioTime
 * credentials stay out of the browser bundle exactly as they do in production.
 */
function biotimeDevApi(env: BiotimeEnv): Plugin {
  return {
    name: "biotime-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/api/biotime")) return next();

        const parsed = new URL(url, "http://localhost");
        const query: Record<string, string> = {};
        parsed.searchParams.forEach((value, key) => {
          query[key] = value;
        });

        const header = (name: string) => {
          const value = req.headers[name];
          return Array.isArray(value) ? value[0] : value || "";
        };

        // The dev server enforces the same admin check as production — otherwise the
        // proxy's security would only be exercised after deploying.
        try {
          await requireAdmin(header("authorization"), env);
        } catch (error) {
          res.statusCode = error instanceof AuthError ? error.status : 401;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Sign-in required.",
            })
          );
          return;
        }

        try {
          const result = await handleBiotimeRequest(query.action || "status", query, env, {
            baseUrl: header("x-biotime-base-url"),
            apiToken: header("x-biotime-token"),
            authScheme: header("x-biotime-scheme"),
          });
          res.statusCode = result.status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(result.body));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
          );
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Third argument '' disables the VITE_ prefix filter so the server-only
  // BIOTIME_* variables are readable by the dev middleware above.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), biotimeDevApi(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
