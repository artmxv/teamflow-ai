import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) childEnv[key] = value;
  }

  Object.assign(childEnv, {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://ci:ci@127.0.0.1:5432/teamflow_env_test",
    JWT_SECRET: "env-test-only-jwt-secret-at-least-32-characters",
    APP_URL: "https://teamflow.example",
    CORS_ORIGIN: "https://teamflow.example",
    FILE_STORAGE_DRIVER: "local",
    DOTENV_CONFIG_PATH: "/dev/null",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    GOOGLE_REDIRECT_URI: "",
  });

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete childEnv[key];
    else childEnv[key] = value;
  }
  return childEnv;
}

function loadEnv(overrides: Record<string, string | undefined> = {}) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "--eval", "import('./src/config/env.ts')"],
    {
      cwd: process.cwd(),
      env: productionEnv(overrides),
      encoding: "utf8",
    },
  );
}

describe("production environment validation", () => {
  it("accepts a strong secret and an explicit storage driver", () => {
    const result = loadEnv();
    assert.equal(result.status, 0, result.stderr);
  });

  it("rejects a short JWT secret", () => {
    const result = loadEnv({ JWT_SECRET: "short-secret" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /at least 32 characters/);
  });

  it("requires an explicit production storage driver", () => {
    const result = loadEnv({ FILE_STORAGE_DRIVER: undefined });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /FILE_STORAGE_DRIVER must be set explicitly/);
  });
});
