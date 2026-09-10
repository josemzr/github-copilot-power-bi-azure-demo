import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { loadConfig } from "../config";
import { getMetrics } from "../metrics";

export async function metrics(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const config = loadConfig();
  const payload = await getMetrics(config);
  context.log("Metrics response completed.", {
    mode: config.mode,
    itemCount: payload.length,
  });
  return {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": "application/json; charset=utf-8",
    },
    jsonBody: payload,
  };
}

app.http("metrics", {
  methods: ["GET"],
  authLevel: "function",
  handler: metrics,
});
