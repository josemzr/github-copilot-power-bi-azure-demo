import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { loadConfig } from "../config";
import { collectAndPersist } from "../metrics";

export async function refresh(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const config = loadConfig();
    const result = await collectAndPersist(config);
    context.log("Manual metrics refresh completed.", {
        mode: result.source,
        itemCount: result.itemCount,
    });
    return { status: 200, jsonBody: result };
}

app.http('refresh', {
    methods: ['POST'],
    authLevel: 'function',
    handler: refresh
});
