import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
const port=Number(process.env.OPEN_CRM_PORT || 5221)+2;
export default defineConfig({testDir:".",testMatch:/calls\.spec\.ts/,workers:1,timeout:45000,use:{...devices["Desktop Chrome"],baseURL:`http://127.0.0.1:${port}`,trace:"retain-on-failure"},webServer:{cwd:path.resolve(import.meta.dirname,"../.."),command:`node tests/e2e/calls-server.mjs ${port}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:30000}});
