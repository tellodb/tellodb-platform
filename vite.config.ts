import { qwikCity } from "@builder.io/qwik-city/vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(loadedEnv)) {
    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [qwikCity({ trailingSlash: false }), qwikVite(), tsconfigPaths()],
    server: {
      port: 5173,
      strictPort: true
    },
    preview: {
      port: 4173,
      strictPort: true
    }
  };
});
