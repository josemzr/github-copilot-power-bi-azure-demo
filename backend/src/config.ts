export type DataSourceMode = "sample" | "github-app" | "enterprise-report";

export interface AppConfig {
  mode: DataSourceMode;
  version: string;
  storageUrl?: string;
  containerName: string;
  publicMetricsEnabled: boolean;
  github?: {
    appId: string;
    installationId: string;
    privateKey: string;
    metricsUrl: string;
  };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Required configuration '${name}' is missing.`);
  }
  return value;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  const normalized = value.toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error(`Expected a boolean value, received '${value}'.`);
}

export function loadConfig(): AppConfig {
  const mode = (process.env.DATA_SOURCE_MODE ?? "sample") as DataSourceMode;
  if (mode !== "sample" && mode !== "github-app" && mode !== "enterprise-report") {
    throw new Error(
      "DATA_SOURCE_MODE must be 'sample', 'github-app', or 'enterprise-report'.",
    );
  }

  const config: AppConfig = {
    mode,
    version: process.env.APP_VERSION ?? "1.0.0",
    storageUrl: process.env.METRICS_STORAGE_URL?.trim(),
    containerName: process.env.METRICS_CONTAINER_NAME?.trim() || "copilot-metrics",
    publicMetricsEnabled: parseBoolean(
      process.env.PUBLIC_METRICS_ENABLED,
      mode === "sample",
    ),
  };

  if (mode === "github-app" || mode === "enterprise-report") {
    config.github = {
      appId: required("GITHUB_APP_ID"),
      installationId: required("GITHUB_INSTALLATION_ID"),
      privateKey: required("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"),
      metricsUrl: required("GITHUB_METRICS_URL"),
    };
  }

  return config;
}
