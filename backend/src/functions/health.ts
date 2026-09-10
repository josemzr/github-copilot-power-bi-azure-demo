import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { loadConfig } from "../config";

export async function health(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const config = loadConfig();
    context.log("Health check completed.", { mode: config.mode });
    return {
        jsonBody: {
            status: "healthy",
            service: "github-copilot-power-bi-backend",
            version: config.version,
            mode: config.mode,
            publicMetricsEnabled: config.publicMetricsEnabled,
            storageConfigured: Boolean(config.storageUrl),
            timestamp: new Date().toISOString(),
        },
    };
}

app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: health
});
