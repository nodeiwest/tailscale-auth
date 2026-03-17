import type { TailscaleIdentity } from "../tailscale/types";

export type AuthDecision =
  | {
      ok: true;
      identity: TailscaleIdentity;
      headers: Record<string, string>;
      clientIp: string;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
      clientIp: string | null;
    };

function normalizeCandidateIp(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    const end = trimmed.indexOf("]");
    return trimmed.slice(1, end) || null;
  }

  const ipv4WithPortMatch = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPortMatch) {
    return ipv4WithPortMatch[1] ?? null;
  }

  return trimmed;
}

export function extractClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstEntry = forwardedFor.split(",")[0];
    if (firstEntry) {
      const ip = normalizeCandidateIp(firstEntry);
      if (ip) {
        return ip;
      }
    }
  }

  const realIp = headers.get("x-real-ip");
  return realIp ? normalizeCandidateIp(realIp) : null;
}

function normalizeSuffixes(suffixes: string[]) {
  return suffixes.map((suffix) => suffix.trim().toLowerCase()).filter(Boolean);
}

function isAllowedLogin(login: string, suffixes: string[]) {
  const normalizedSuffixes = normalizeSuffixes(suffixes);
  if (normalizedSuffixes.length === 0) {
    return true;
  }

  return normalizedSuffixes.some((suffix) => login.endsWith(suffix));
}

export function buildAuthHeaders(identity: TailscaleIdentity) {
  const headers: Record<string, string> = {
    "X-Auth-User": identity.login,
    "X-Auth-Name": identity.displayName,
    "X-Tailscale-User-Login": identity.login,
    "X-Tailscale-User-Name": identity.displayName,
  };

  if (identity.userId) {
    headers["X-Tailscale-User-Id"] = identity.userId;
  }

  if (identity.nodeId) {
    headers["X-Tailscale-Node-Id"] = identity.nodeId;
  }

  if (identity.nodeName) {
    headers["X-Tailscale-Node-Name"] = identity.nodeName;
  }

  if (identity.tailnet) {
    headers["X-Tailscale-Tailnet"] = identity.tailnet;
  }

  return headers;
}

export function allowRequest(identity: TailscaleIdentity, clientIp: string): AuthDecision {
  return {
    ok: true,
    identity,
    headers: buildAuthHeaders(identity),
    clientIp,
  };
}

export function denyRequest(
  statusCode: number,
  error: string,
  clientIp: string | null,
): AuthDecision {
  return {
    ok: false,
    statusCode,
    error,
    clientIp,
  };
}

export function authorizeIdentity(
  identity: TailscaleIdentity | null,
  clientIp: string | null,
  allowedLoginSuffixes: string[],
): AuthDecision {
  if (!clientIp) {
    return denyRequest(401, "Missing client IP.", null);
  }

  if (!identity) {
    return denyRequest(401, "Request is not associated with a Tailscale user.", clientIp);
  }

  if (!isAllowedLogin(identity.login, allowedLoginSuffixes)) {
    return denyRequest(403, "User is outside the allowed login suffix list.", clientIp);
  }

  return allowRequest(identity, clientIp);
}
