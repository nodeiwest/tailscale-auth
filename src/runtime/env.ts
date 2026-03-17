export type RuntimeConfig = {
  host: string;
  port: number;
  authPath: string;
  healthPath: string;
  tailscaleSocketPath: string;
  allowedLoginSuffixes: string[];
  permissivePathPrefixes: string[];
  logRequests: boolean;
};

function readString(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function readNumber(name: string, fallback: number) {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected ${name} to be a positive number, received "${value}".`);
  }

  return parsed;
}

function readBoolean(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }

  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }

  if (value === "false" || value === "0" || value === "no") {
    return false;
  }

  throw new Error(`Expected ${name} to be a boolean, received "${value}".`);
}

function readCsv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    host: readString("HOST", "0.0.0.0"),
    port: readNumber("PORT", 3000),
    authPath: readString("AUTH_PATH", "/traefik/auth"),
    healthPath: readString("HEALTH_PATH", "/healthz"),
    tailscaleSocketPath: readString(
      "TAILSCALE_SOCKET_PATH",
      "/var/run/tailscale/tailscaled.sock",
    ),
    allowedLoginSuffixes: readCsv("ALLOWED_LOGIN_SUFFIXES"),
    permissivePathPrefixes: readCsv("PERMISSIVE_PATH_PREFIXES"),
    logRequests: readBoolean("LOG_REQUESTS", true),
  };
}
