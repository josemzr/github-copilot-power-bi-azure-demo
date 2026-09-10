import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPrivateKey } from "node:crypto";
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import { SignJWT } from "jose";
import { AppConfig } from "./config";

export type MetricsPayload = Record<string, unknown>[];

export interface CollectionResult {
  source: "sample" | "github-app" | "enterprise-report";
  collectedAt: string;
  itemCount: number;
  latestBlob?: string;
  historyBlob?: string;
}

function assertMetricsPayload(value: unknown): asserts value is MetricsPayload {
  if (!Array.isArray(value)) {
    throw new Error("The metrics payload must be a JSON array.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textual(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function extractReportDownloadLinks(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.download_links)) {
    throw new Error("GitHub did not return report download links.");
  }

  const links = value.download_links.filter(
    (link): link is string => typeof link === "string" && link.length > 0,
  );
  if (links.length === 0 || links.length > 10) {
    throw new Error("GitHub returned an invalid number of report download links.");
  }
  for (const link of links) {
    const url = new URL(link);
    if (url.protocol !== "https:") {
      throw new Error("GitHub returned a non-HTTPS report download link.");
    }
  }
  return links;
}

export function extractReportDayTotals(value: unknown): MetricsPayload {
  if (!isRecord(value) || !Array.isArray(value.day_totals)) {
    throw new Error("The downloaded GitHub report does not contain day_totals.");
  }

  const dayTotals = value.day_totals;
  assertMetricsPayload(dayTotals);
  for (const day of dayTotals) {
    if (!isRecord(day) || typeof day.day !== "string") {
      throw new Error("A GitHub report day_totals item has an invalid day.");
    }
  }
  return dayTotals;
}

export async function loadSampleMetrics(): Promise<MetricsPayload> {
  const filePath = path.join(
    process.cwd(),
    "dist",
    "data",
    "copilot_metrics_response_sample.json",
  );
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  assertMetricsPayload(parsed);
  return parsed;
}

export function toLegacyMetrics(dayTotals: MetricsPayload): MetricsPayload {
  return dayTotals.map((day) => {
    const adoptionPhases = records(day.totals_by_ai_adoption_phase);
    const featureTotals = records(day.totals_by_feature);
    const ideTotals = records(day.totals_by_ide);
    const languageTotals = records(day.totals_by_language_feature).filter(
      (entry) => entry.feature === "code_completion",
    );
    const pullRequests = isRecord(day.pull_requests) ? day.pull_requests : {};
    const engagedUsers = adoptionPhases.reduce(
      (total, phase) => total + numeric(phase.total_engaged_users),
      0,
    );
    const codeReviewUsers = numeric(day.daily_active_copilot_code_review_users);
    const chatFeatures = featureTotals.filter((entry) => {
      const feature = textual(entry.feature, "").toLowerCase();
      return feature.includes("chat") || feature === "copilot_app";
    });

    const editors = ideTotals.map((entry) => ({
      name: textual(entry.ide, "unknown"),
      total_engaged_users: 0,
      models: [
        {
          name: "All models",
          is_custom_model: false,
          custom_model_training_date: null,
          total_engaged_users: 0,
          languages: [
            {
              name: "All languages",
              total_engaged_users: 0,
              total_code_suggestions: numeric(entry.code_generation_activity_count),
              total_code_acceptances: numeric(entry.code_acceptance_activity_count),
              total_code_lines_suggested:
                numeric(entry.loc_suggested_to_add_sum) +
                numeric(entry.loc_suggested_to_delete_sum),
              total_code_lines_accepted:
                numeric(entry.loc_added_sum) + numeric(entry.loc_deleted_sum),
            },
          ],
        },
      ],
    }));
    if (editors.length === 0) {
      editors.push({
        name: "No data reported",
        total_engaged_users: 0,
        models: [
          {
            name: "No data reported",
            is_custom_model: false,
            custom_model_training_date: null,
            total_engaged_users: 0,
            languages: [
              {
                name: "No data reported",
                total_engaged_users: 0,
                total_code_suggestions: 0,
                total_code_acceptances: 0,
                total_code_lines_suggested: 0,
                total_code_lines_accepted: 0,
              },
            ],
          },
        ],
      });
    }

    const ideChatEditors = chatFeatures.length === 0
      ? [
          {
            name: "No data reported",
            total_engaged_users: 0,
            models: [
              {
                name: "No data reported",
                total_chats: 0,
                is_custom_model: false,
                total_engaged_users: 0,
                total_chat_copy_events: 0,
                total_chat_insertion_events: 0,
              },
            ],
          },
        ]
      : [
          {
            name: "All IDEs",
            total_engaged_users: 0,
            models: chatFeatures.map((entry) => ({
              name: textual(entry.feature, "chat"),
              total_chats: numeric(entry.user_initiated_interaction_count),
              is_custom_model: false,
              total_engaged_users: 0,
              total_chat_copy_events: numeric(entry.code_acceptance_activity_count),
              total_chat_insertion_events: 0,
            })),
          },
        ];

    return {
      date: textual(day.day, ""),
      total_active_users: numeric(day.daily_active_users),
      total_engaged_users: engagedUsers,
      copilot_ide_code_completions: {
        total_engaged_users: engagedUsers,
        languages: languageTotals.length === 0
          ? [{ name: "No data reported", total_engaged_users: 0 }]
          : languageTotals.map((entry) => ({
              name: textual(entry.language, "unknown"),
              total_engaged_users: 0,
            })),
        editors,
      },
      copilot_ide_chat: {
        total_engaged_users: 0,
        editors: ideChatEditors,
      },
      copilot_dotcom_chat: {
        total_engaged_users: 0,
        models: [
          {
            name: "No data reported",
            is_custom_model: false,
            custom_model_training_date: null,
            total_engaged_users: 0,
            total_chats: 0,
          },
        ],
      },
      copilot_dotcom_pull_requests: {
        total_engaged_users: codeReviewUsers,
        repositories: [
          {
            name: "All repositories",
            total_engaged_users: codeReviewUsers,
            models: [
              {
                name: "Copilot",
                is_custom_model: false,
                custom_model_training_date: null,
                total_pr_summaries_created: numeric(pullRequests.total_created_by_copilot),
                total_engaged_users: codeReviewUsers,
              },
            ],
          },
        ],
      },
    };
  });
}

async function createInstallationToken(config: NonNullable<AppConfig["github"]>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = createPrivateKey(config.privateKey);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(config.appId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .sign(privateKey);

  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(config.installationId)}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "github-copilot-enterprise-metrics",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub installation token request failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new Error("GitHub did not return an installation access token.");
  }
  return body.token;
}

async function loadGitHubMetrics(config: NonNullable<AppConfig["github"]>): Promise<MetricsPayload> {
  const token = await createInstallationToken(config);
  const response = await fetch(config.metricsUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "github-copilot-enterprise-metrics",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub metrics request failed with HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  if (Array.isArray(payload)) {
    assertMetricsPayload(payload);
    return payload;
  }

  const links = extractReportDownloadLinks(payload);
  const reports = await Promise.all(
    links.map(async (link) => {
      const reportResponse = await fetch(link, {
        signal: AbortSignal.timeout(60_000),
        headers: {
          Accept: "application/json",
          "User-Agent": "github-copilot-enterprise-metrics",
        },
      });
      if (!reportResponse.ok) {
        throw new Error(`GitHub report download failed with HTTP ${reportResponse.status}.`);
      }
      return extractReportDayTotals(await reportResponse.json());
    }),
  );

  const uniqueDays = new Map<string, Record<string, unknown>>();
  for (const day of reports.flat()) {
    const key = `${String(day.enterprise_id ?? "")}:${String(day.organization_id ?? "")}:${String(day.day)}`;
    uniqueDays.set(key, day);
  }
  const dayTotals = [...uniqueDays.values()].sort(
    (left, right) => String(left.day).localeCompare(String(right.day)),
  );
  if (dayTotals.length === 0) {
    throw new Error("The downloaded GitHub report contains no day_totals records.");
  }
  return dayTotals;
}

export async function getMetrics(config: AppConfig): Promise<MetricsPayload> {
  if (config.mode === "sample") {
    return loadSampleMetrics();
  }
  if (!config.github) {
    throw new Error("GitHub App configuration is unavailable.");
  }
  return loadGitHubMetrics(config.github);
}

function getBlobService(config: AppConfig): BlobServiceClient {
  if (!config.storageUrl) {
    throw new Error("METRICS_STORAGE_URL is required for metrics persistence.");
  }
  return new BlobServiceClient(config.storageUrl, new DefaultAzureCredential());
}

export async function persistMetrics(
  config: AppConfig,
  payload: MetricsPayload,
  collectedAt = new Date(),
): Promise<Pick<CollectionResult, "latestBlob" | "historyBlob">> {
  const container = getBlobService(config).getContainerClient(config.containerName);
  const body = JSON.stringify(payload);
  const timestamp = collectedAt.toISOString().replace(/[:.]/g, "-");
  const latestBlob = "latest.json";
  const historyBlob = `history/${timestamp}.json`;
  const options = {
    blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
    metadata: {
      source: config.mode,
      collectedAt: collectedAt.toISOString(),
    },
  };

  await Promise.all([
    container.getBlockBlobClient(latestBlob).upload(body, Buffer.byteLength(body), options),
    container.getBlockBlobClient(historyBlob).upload(body, Buffer.byteLength(body), options),
  ]);

  return { latestBlob, historyBlob };
}

export async function collectAndPersist(config: AppConfig): Promise<CollectionResult> {
  const collectedAt = new Date();
  const payload = await getMetrics(config);
  const blobs = await persistMetrics(config, payload, collectedAt);
  return {
    source: config.mode,
    collectedAt: collectedAt.toISOString(),
    itemCount: payload.length,
    ...blobs,
  };
}
