import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config";

const names = [
  "DATA_SOURCE_MODE",
  "PUBLIC_METRICS_ENABLED",
  "GITHUB_APP_ID",
  "GITHUB_INSTALLATION_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_METRICS_URL",
];

function resetEnvironment(): void {
  for (const name of names) {
    delete process.env[name];
  }
}

test("sample mode is the safe demo default", () => {
  resetEnvironment();
  const config = loadConfig();
  assert.equal(config.mode, "sample");
  assert.equal(config.publicMetricsEnabled, true);
});

test("Azure-style boolean casing is accepted", () => {
  resetEnvironment();
  process.env.PUBLIC_METRICS_ENABLED = "True";
  assert.equal(loadConfig().publicMetricsEnabled, true);
});

test("production mode requires complete GitHub App configuration", () => {
  resetEnvironment();
  process.env.DATA_SOURCE_MODE = "github-app";
  assert.throws(() => loadConfig(), /GITHUB_APP_ID/);
});

test("production mode does not expose metrics by default", () => {
  resetEnvironment();
  process.env.DATA_SOURCE_MODE = "github-app";
  process.env.GITHUB_APP_ID = "123";
  process.env.GITHUB_INSTALLATION_ID = "456";
  process.env.GITHUB_APP_PRIVATE_KEY = "private-key";
  process.env.GITHUB_METRICS_URL = "https://api.github.com/example";
  const config = loadConfig();
  assert.equal(config.publicMetricsEnabled, false);
});

test("enterprise report mode uses GitHub App configuration", () => {
  resetEnvironment();
  process.env.DATA_SOURCE_MODE = "enterprise-report";
  process.env.GITHUB_APP_ID = "123456";
  process.env.GITHUB_INSTALLATION_ID = "789012";
  process.env.GITHUB_APP_PRIVATE_KEY = "private-key";
  process.env.GITHUB_METRICS_URL = "https://api.github.com/enterprises/example/copilot/metrics/reports/enterprise-28-day/latest";
  const config = loadConfig();
  assert.equal(config.mode, "enterprise-report");
  assert.equal(config.github?.installationId, "789012");
});
