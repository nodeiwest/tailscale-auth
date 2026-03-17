import { Elysia } from "elysia";

import { authorizeIdentity, extractClientIp } from "../auth/forward-auth";
import type { RuntimeConfig } from "./env";
import { lookupTailscaleIdentity } from "../tailscale/local-api";

function logDecision(config: RuntimeConfig, event: string, details: Record<string, unknown>) {
  if (!config.logRequests) {
    return;
  }

  console.info(
    JSON.stringify({
      event,
      service: "tailscale-auth",
      ...details,
    }),
  );
}

function getForwardedUri(request: Request) {
  return request.headers.get("x-forwarded-uri") ?? "";
}

function isPermissivePath(config: RuntimeConfig, request: Request) {
  const forwardedUri = getForwardedUri(request);

  if (!forwardedUri || config.permissivePathPrefixes.length === 0) {
    return false;
  }

  return config.permissivePathPrefixes.some((prefix) => forwardedUri.startsWith(prefix));
}

export function createApp(config: RuntimeConfig) {
  return new Elysia()
    .get(config.healthPath, () => ({
      status: "ok",
    }))
    .all(config.authPath, async ({ request, set }) => {
      const clientIp = extractClientIp(request.headers);

      try {
        const identity = clientIp
          ? await lookupTailscaleIdentity(config.tailscaleSocketPath, clientIp)
          : null;
        const decision = authorizeIdentity(identity, clientIp, config.allowedLoginSuffixes);

        if (!decision.ok) {
          if (decision.statusCode === 401 && isPermissivePath(config, request)) {
            logDecision(config, "auth.pass_through", {
              reason: decision.error,
              clientIp: decision.clientIp,
              path: getForwardedUri(request),
              method: request.headers.get("x-forwarded-method"),
              host: request.headers.get("x-forwarded-host"),
            });

            return {
              ok: true,
              user: null,
            };
          }

          set.status = decision.statusCode;
          logDecision(config, "auth.deny", {
            reason: decision.error,
            clientIp: decision.clientIp,
            path: getForwardedUri(request),
            method: request.headers.get("x-forwarded-method"),
            host: request.headers.get("x-forwarded-host"),
          });
          return {
            error: decision.error,
          };
        }

        for (const [name, value] of Object.entries(decision.headers)) {
          set.headers[name] = value;
        }

        logDecision(config, "auth.allow", {
          clientIp: decision.clientIp,
          login: decision.identity.login,
          nodeName: decision.identity.nodeName,
          path: getForwardedUri(request),
          method: request.headers.get("x-forwarded-method"),
          host: request.headers.get("x-forwarded-host"),
        });

        return {
          ok: true,
          user: decision.identity.login,
        };
      } catch (error) {
        set.status = 502;

        logDecision(config, "auth.error", {
          clientIp,
          message: error instanceof Error ? error.message : String(error),
        });

        return {
          error: "Unable to query Tailscale LocalAPI.",
        };
      }
    });
}
