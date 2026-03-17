import { request as httpRequest } from "node:http";

import type { TailscaleIdentity, TailscaleWhoisResponse } from "./types";

export class TailscaleLookupError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "TailscaleLookupError";
  }
}

function parseJson<T>(value: string) {
  return JSON.parse(value) as T;
}

function formatWhoisAddress(ip: string) {
  return ip.includes(":") ? `[${ip}]:0` : `${ip}:0`;
}

function normalizeTailnet(login: string) {
  const atIndex = login.lastIndexOf("@");
  if (atIndex === -1) {
    return null;
  }

  return login.slice(atIndex + 1).toLowerCase();
}

function mapIdentity(payload: TailscaleWhoisResponse): TailscaleIdentity | null {
  const login = payload.UserProfile?.LoginName?.trim().toLowerCase();

  if (!login) {
    return null;
  }

  return {
    login,
    displayName: payload.UserProfile?.DisplayName?.trim() || login,
    userId:
      payload.UserProfile?.ID !== undefined && payload.UserProfile.ID !== null
        ? String(payload.UserProfile.ID)
        : null,
    nodeId:
      payload.Node?.ID !== undefined && payload.Node.ID !== null ? String(payload.Node.ID) : null,
    nodeName: payload.Node?.ComputedName ?? payload.Node?.Name ?? null,
    tailnet: normalizeTailnet(login),
  };
}

async function callLocalApi<T>(socketPath: string, path: string) {
  return await new Promise<T>((resolve, reject) => {
    const request = httpRequest(
      {
        socketPath,
        path,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const statusCode = response.statusCode ?? 500;

          if (statusCode < 200 || statusCode >= 300) {
            reject(
              new TailscaleLookupError(
                body || `Tailscale LocalAPI returned ${statusCode}.`,
                statusCode,
              ),
            );
            return;
          }

          try {
            resolve(parseJson<T>(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

export async function lookupTailscaleIdentity(socketPath: string, ip: string) {
  const payload = await callLocalApi<TailscaleWhoisResponse>(
    socketPath,
    `/localapi/v0/whois?addr=${encodeURIComponent(formatWhoisAddress(ip))}`,
  );

  return mapIdentity(payload);
}
