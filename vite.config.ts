import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createServer } from "./server";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const root = __dirname;
  const fileEnv = loadEnv(mode, root, "");
  const viteLms = (fileEnv.VITE_LMS_API_BASE_URL ?? "").trim();
  const learningLabUpstream = (fileEnv.LEARNING_LAB_API_BASE_URL ?? "").trim();
  /**
   * Browser API base for the SPA:
   * - `VITE_LMS_API_BASE_URL` wins when set (e.g. `/v1` for same-origin Express proxy).
   * - Else `LEARNING_LAB_API_BASE_URL` is used so dev hits API Gateway directly (not localhost).
   * - To force the old same-origin proxy without duplicating the upstream URL, set
   *   `VITE_LMS_API_BASE_URL=/v1` and keep `LEARNING_LAB_API_BASE_URL` for the server forwarder.
   */
  const effectiveLmsBase = viteLms || learningLabUpstream || "";

  return {
    ...(effectiveLmsBase !== ""
      ? {
          define: {
            "import.meta.env.VITE_LMS_API_BASE_URL": JSON.stringify(effectiveLmsBase.replace(/\/$/, "")),
          },
        }
      : {}),
    server: {
      host: "::",
      port: 8080,
      fs: {
        // Allow Vite to serve files from the project root, client, and shared folders.
        // index.html lives at the project root so include "./" here to avoid
        // the "outside of Vite serving allow list" warning during development.
        allow: ["./", "./client", "./shared"],
        deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
      },
    },
    build: {
      outDir: "dist/spa",
    },
    plugins: [react(), expressPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./client"),
        "@shared": path.resolve(__dirname, "./shared"),
      },
    },
  };
});

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      const app = createServer();

      // Add Express app as middleware to Vite dev server
      server.middlewares.use(app);
    },
  };
}
