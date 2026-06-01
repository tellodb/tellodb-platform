import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";
import { createServer } from "node:http";
import { loadEnv } from "vite";

import render from "./entry.ssr";

const runtimeEnv = loadEnv(
  process.env.NODE_ENV === "production" ? "production" : "development",
  process.cwd(),
  ""
);

for (const [key, value] of Object.entries(runtimeEnv)) {
  if (process.env[key] == null) {
    process.env[key] = value;
  }
}

const PORT = Number(process.env.PORT ?? 3004);
const HOST = process.env.HOST ?? "127.0.0.1";

const { router, notFound, staticFile } = createQwikCity({
  render,
  qwikCityPlan,
  static: {
    cacheControl: "public, max-age=31536000, immutable"
  }
});

const server = createServer();

server.on("request", (req, res) => {
  staticFile(req, res, () => {
    router(req, res, () => {
      notFound(req, res, () => undefined);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Node server listening on http://${HOST}:${PORT}`);
});
