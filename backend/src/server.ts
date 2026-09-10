import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "./config";
import { getMetrics } from "./metrics";

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function pathOf(request: IncomingMessage): string {
  return new URL(request.url ?? "/", "http://localhost").pathname;
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const config = loadConfig();
  const path = pathOf(request);

  if (request.method === "GET" && path === "/api/health") {
    sendJson(response, 200, {
      status: "healthy",
      service: "github-copilot-power-bi-backend",
      hosting: "azure-app-service-policy-fallback",
      version: config.version,
      mode: config.mode,
      publicMetricsEnabled: config.publicMetricsEnabled,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (request.method === "GET" && path === "/api/metrics") {
    if (!config.publicMetricsEnabled) {
      sendJson(response, 403, { error: "Public metrics access is disabled." });
      return;
    }
    const payload = await getMetrics(config);
    response.setHeader("Cache-Control", "public, max-age=300");
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "POST" && path === "/api/refresh") {
    const expectedKey = process.env.REFRESH_API_KEY;
    if (!expectedKey || request.headers["x-api-key"] !== expectedKey) {
      sendJson(response, 401, { error: "A valid refresh API key is required." });
      return;
    }
    const payload = await getMetrics(config);
    sendJson(response, 200, {
      source: config.mode,
      collectedAt: new Date().toISOString(),
      itemCount: payload.length,
      persisted: false,
      note: "The policy-fallback demo validates the source but does not persist to network-isolated storage.",
    });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

const port = Number(process.env.PORT ?? 8080);
createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("Request failed.", { message });
    sendJson(response, 500, { error: "The request could not be completed." });
  });
}).listen(port, () => {
  console.log(`GitHub Copilot Power BI backend listening on port ${port}.`);
});
