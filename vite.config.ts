import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import os from "os";
import { decodeBody, defaultConfig, handleDeviceRequest, type DocStore } from "./api/_deviceIngest";

/** This machine's LAN addresses, so the console can print what to type into the device. */
function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry): entry is os.NetworkInterfaceInfo =>
      Boolean(entry && entry.family === "IPv4" && !entry.internal)
    )
    .map((entry) => entry.address);
}

/**
 * Serves /iclock/* during `npm run dev`, so the fingerprint terminal can be tested against
 * this machine over the office LAN before anything is deployed.
 *
 * This is the only way to prove the device end of the integration without first solving
 * the HTTPS problem: Vite serves plain HTTP on the LAN, which is exactly what a
 * classic-series ZKTeco terminal speaks. In production Vercel runs api/iclock/cdata.ts
 * instead; both call the same handleDeviceRequest.
 */
function iclockDevApi(env: Record<string, string | undefined>): Plugin {
  // Built lazily: a missing service-account key must not stop ordinary frontend work.
  let store: DocStore | null = null;
  let storeError = "";

  return {
    name: "iclock-dev-api",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const port = server.config.server.port ?? 8080;
        const addresses = lanAddresses();
        console.log("");
        console.log("  \x1b[35m➜  Fingerprint device (ADMS):\x1b[0m plain HTTP on this LAN");
        for (const address of addresses) {
          console.log(`     Server Address \x1b[36m${address}\x1b[0m   Server Port \x1b[36m${port}\x1b[0m`);
        }
        if (addresses.length === 0) console.log("     (no LAN address found)");
        console.log("     Set these on the device: Menu > Comm. > Cloud Server Setting");
        console.log("");
      });

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || "";
        if (!rawUrl.startsWith("/iclock")) return next();

        const url = new URL(rawUrl, "http://device.local");
        const query: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          query[key] = value;
        });

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        const bodyBuffer = Buffer.concat(chunks);

        if (!store && !storeError) {
          try {
            // Imported here rather than at module scope so the Vite config still loads
            // when firebase-admin or its credentials are absent.
            const { getDeviceStore } = await import("./api/_firebaseAdmin");
            store = getDeviceStore(env as NodeJS.ProcessEnv);
          } catch (error) {
            storeError = error instanceof Error ? error.message : String(error);
          }
        }

        if (!store) {
          console.error(`\x1b[31m[iclock]\x1b[0m ${storeError}`);
          // Still answer OK — the device must not be pushed into a retry loop by our
          // configuration problem, and the console line above says what to fix.
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("OK");
          return;
        }

        const headers: Record<string, string> = {};
        for (const name of ["user-agent", "content-type", "content-length", "host"]) {
          const value = req.headers[name];
          if (value !== undefined) headers[name] = String(value);
        }

        const result = await handleDeviceRequest(
          {
            method: (req.method || "GET").toUpperCase(),
            path: url.pathname,
            query,
            body: decodeBody(bodyBuffer),
            bodyBytes: bodyBuffer.length,
            headers,
            remoteAddress: req.socket.remoteAddress || "",
          },
          store,
          defaultConfig(env)
        );

        if (result.log) console.log(`\x1b[35m[iclock]\x1b[0m ${result.log}`);

        res.statusCode = result.status;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(result.body);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Third argument '' disables the VITE_ prefix filter so the server-only
  // FIREBASE_* variables are readable by the device middleware above.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), iclockDevApi(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
