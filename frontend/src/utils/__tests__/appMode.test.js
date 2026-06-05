import { describe, expect, it } from "vitest";
import {
  APP_MODES,
  getAppModeFromEnv,
  isWebAdminModeFromEnv,
} from "../appMode";

describe("appMode", () => {
  it("uses POS mode by default", () => {
    expect(getAppModeFromEnv({})).toBe(APP_MODES.POS);
    expect(isWebAdminModeFromEnv({})).toBe(false);
  });

  it("detects web admin mode from VITE_APP_MODE", () => {
    const env = { VITE_APP_MODE: APP_MODES.WEB_ADMIN };

    expect(getAppModeFromEnv(env)).toBe(APP_MODES.WEB_ADMIN);
    expect(isWebAdminModeFromEnv(env)).toBe(true);
  });
});
