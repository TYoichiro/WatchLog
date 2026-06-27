import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assertRequiredEnv, requiredEnv } from "./env";

const TEST_VAR = "TEST_WATCHLOG_ENV_VAR";
const TEST_VAR_1 = "TEST_WATCHLOG_ENV_VAR_1";
const TEST_VAR_2 = "TEST_WATCHLOG_ENV_VAR_2";

describe("requiredEnv", () => {
  beforeEach(() => {
    delete process.env[TEST_VAR];
  });

  afterEach(() => {
    delete process.env[TEST_VAR];
  });

  it("設定済みの環境変数の値を返す", () => {
    process.env[TEST_VAR] = "hello";
    expect(requiredEnv(TEST_VAR)).toBe("hello");
  });

  it("未設定の場合は Error を投げる", () => {
    expect(() => requiredEnv(TEST_VAR)).toThrow(
      `Missing required environment variable: ${TEST_VAR}`
    );
  });

  it("空文字の場合は Error を投げる", () => {
    process.env[TEST_VAR] = "";
    expect(() => requiredEnv(TEST_VAR)).toThrow();
  });
});

describe("assertRequiredEnv", () => {
  beforeEach(() => {
    delete process.env[TEST_VAR_1];
    delete process.env[TEST_VAR_2];
  });

  afterEach(() => {
    delete process.env[TEST_VAR_1];
    delete process.env[TEST_VAR_2];
  });

  it("すべて設定済みの場合は何も投げない", () => {
    process.env[TEST_VAR_1] = "v1";
    process.env[TEST_VAR_2] = "v2";
    expect(() => assertRequiredEnv([TEST_VAR_1, TEST_VAR_2])).not.toThrow();
  });

  it("1 つでも未設定なら Error を投げる", () => {
    process.env[TEST_VAR_1] = "v1";
    expect(() => assertRequiredEnv([TEST_VAR_1, TEST_VAR_2])).toThrow(
      `Missing required environment variable: ${TEST_VAR_2}`
    );
  });

  it("空配列を渡した場合は何も投げない", () => {
    expect(() => assertRequiredEnv([])).not.toThrow();
  });
});
