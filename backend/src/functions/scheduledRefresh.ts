import { app, InvocationContext, Timer } from "@azure/functions";
import { loadConfig } from "../config";
import { collectAndPersist } from "../metrics";

export async function scheduledRefresh(myTimer: Timer, context: InvocationContext): Promise<void> {
    if (myTimer.isPastDue) {
        context.warn("Scheduled metrics refresh is running late.");
    }
    const result = await collectAndPersist(loadConfig());
    context.log("Scheduled metrics refresh completed.", {
        mode: result.source,
        itemCount: result.itemCount,
    });
}

app.timer('scheduledRefresh', {
    schedule: '0 0 6 * * *',
    handler: scheduledRefresh
});
