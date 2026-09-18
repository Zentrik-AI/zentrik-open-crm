import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Develop against a workspace folder: OPEN_CRM_WORKSPACE=<folder> npm run dev */
function workspaceFolder(): Plugin | null {
  const dir = process.env.OPEN_CRM_WORKSPACE;
  if (!dir) return null;
  return {
    name: "open-crm-workspace-folder",
    async configureServer(server) {
      const { createApi } = await import("./cli/api.ts");
      const api = createApi(path.resolve(dir));
      server.middlewares.use((req, res, next) => void api.handle(req, res).then((handled) => handled || next()));
      server.httpServer?.on("close", () => api.close());
    },
    transformIndexHtml: () => [{ tag: "script", children: 'window.__OPEN_CRM__={backend:"folder"}', injectTo: "head-prepend" }],
  };
}

export default defineConfig({
  plugins: [react(), workspaceFolder()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.OPEN_CRM_PORT) || 5177,
  },
});
