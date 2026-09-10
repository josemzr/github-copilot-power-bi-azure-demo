import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { loadConfig } from "../config";
import { getMetrics, toLegacyMetrics } from "../metrics";

export async function compatibilityMetrics(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const config = loadConfig();
  const payload = toLegacyMetrics(await getMetrics(config));
  context.log("PBIX compatibility response completed.", {
    mode: config.mode,
    itemCount: payload.length,
  });
  return {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": "application/json; charset=utf-8",
      "Warning": '299 - "Compatibility mapping; review README metric semantics"',
    },
    jsonBody: payload,
  };
}

app.http("compatibilityMetrics", {
  methods: ["GET"],
  authLevel: "function",
  route: "compatibility-metrics",
  handler: compatibilityMetrics,
});
