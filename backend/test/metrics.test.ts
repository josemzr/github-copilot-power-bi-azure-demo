import assert from "node:assert/strict";
import test from "node:test";
import {
  extractReportDayTotals,
  extractReportDownloadLinks,
  loadSampleMetrics,
  toLegacyMetrics,
} from "../src/metrics";

test("the packaged sample is a non-empty Copilot metrics array", async () => {
  const payload = await loadSampleMetrics();
  assert.ok(payload.length > 0);
  assert.equal(typeof payload[0].date, "string");
  assert.equal(typeof payload[0].total_active_users, "number");
});

test("Enterprise report download links require HTTPS", () => {
  assert.deepEqual(
    extractReportDownloadLinks({
      download_links: ["https://objects.example.test/report.json"],
    }),
    ["https://objects.example.test/report.json"],
  );
  assert.throws(
    () => extractReportDownloadLinks({ download_links: ["http://example.test/report.json"] }),
    /non-HTTPS/,
  );
});

test("Enterprise report day totals are validated", () => {
  const records = extractReportDayTotals({
    report_start_day: "2026-08-12",
    report_end_day: "2026-09-08",
    day_totals: [
      { day: "2026-08-12", daily_active_users: 10 },
      { day: "2026-08-13", daily_active_users: 12 },
    ],
  });
  assert.equal(records.length, 2);
  assert.equal(records[1].daily_active_users, 12);
  assert.throws(() => extractReportDayTotals({ day_totals: [{}] }), /invalid day/);
});

test("Enterprise day totals map to the legacy PBIX contract", () => {
  const [record] = toLegacyMetrics([
    {
      day: "2026-09-08",
      daily_active_users: 12,
      daily_active_copilot_code_review_users: 3,
      totals_by_ai_adoption_phase: [
        { phase: "Phase 1", total_engaged_users: 4 },
        { phase: "Phase 2", total_engaged_users: 5 },
      ],
      totals_by_feature: [
        {
          feature: "copilot_app",
          user_initiated_interaction_count: 8,
          code_acceptance_activity_count: 2,
        },
      ],
      totals_by_ide: [
        {
          ide: "vscode",
          code_generation_activity_count: 10,
          code_acceptance_activity_count: 6,
          loc_suggested_to_add_sum: 100,
          loc_suggested_to_delete_sum: 20,
          loc_added_sum: 70,
          loc_deleted_sum: 10,
        },
      ],
      totals_by_language_feature: [
        { feature: "code_completion", language: "typescript" },
      ],
      pull_requests: { total_created_by_copilot: 2 },
    },
  ]);

  assert.equal(record.date, "2026-09-08");
  assert.equal(record.total_active_users, 12);
  assert.equal(record.total_engaged_users, 9);
  const completions = record.copilot_ide_code_completions as Record<string, unknown>;
  const editors = completions.editors as Record<string, unknown>[];
  assert.equal(editors[0].name, "vscode");
  const pullRequests = record.copilot_dotcom_pull_requests as Record<string, unknown>;
  assert.equal(pullRequests.total_engaged_users, 3);
});

test("legacy compatibility tables retain schema when breakdowns are empty", () => {
  const [record] = toLegacyMetrics([
    {
      day: "2026-09-08",
      daily_active_users: 0,
      pull_requests: {},
      totals_by_ai_adoption_phase: [],
      totals_by_feature: [],
      totals_by_ide: [],
      totals_by_language_feature: [],
    },
  ]);
  const completions = record.copilot_ide_code_completions as Record<string, unknown>;
  const editors = completions.editors as Record<string, unknown>[];
  const languages = completions.languages as Record<string, unknown>[];
  const dotcom = record.copilot_dotcom_chat as Record<string, unknown>;
  const models = dotcom.models as Record<string, unknown>[];
  assert.equal(editors[0].name, "No data reported");
  assert.equal(languages[0].name, "No data reported");
  assert.equal(models[0].name, "No data reported");
});
