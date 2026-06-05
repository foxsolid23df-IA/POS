export const APP_MODES = {
  POS: "pos",
  WEB_ADMIN: "web_admin",
};

export const getAppModeFromEnv = (env = import.meta.env) =>
  env?.VITE_APP_MODE || APP_MODES.POS;

export const getAppMode = () => getAppModeFromEnv();

export const isWebAdminModeFromEnv = (env = import.meta.env) =>
  getAppModeFromEnv(env) === APP_MODES.WEB_ADMIN;

export const isWebAdminMode = () => isWebAdminModeFromEnv();

export const isDesktopPOSMode = () => !isWebAdminMode();

export const requiresTerminal = () => isDesktopPOSMode();
