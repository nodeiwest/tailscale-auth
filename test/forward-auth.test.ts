import { describe, expect, it } from "bun:test";

import {
  authorizeIdentity,
  buildAuthHeaders,
  extractClientIp,
} from "../src/auth/forward-auth";

describe("extractClientIp", () => {
  it("uses the first x-forwarded-for address", () => {
    const headers = new Headers({
      "x-forwarded-for": "100.64.0.10, 10.0.0.1",
    });

    expect(extractClientIp(headers)).toBe("100.64.0.10");
  });

  it("strips the port from ipv4 addresses", () => {
    const headers = new Headers({
      "x-forwarded-for": "100.64.0.10:42313",
    });

    expect(extractClientIp(headers)).toBe("100.64.0.10");
  });

  it("supports bracketed ipv6 addresses", () => {
    const headers = new Headers({
      "x-forwarded-for": "[fd7a:115c:a1e0::1]:42313",
    });

    expect(extractClientIp(headers)).toBe("fd7a:115c:a1e0::1");
  });
});

describe("permissive bootstrap behavior", () => {
  it("still returns a 401 decision when identity is missing", () => {
    const decision = authorizeIdentity(null, "100.64.0.10", []);

    expect(decision.ok).toBe(false);
    if (decision.ok) {
      throw new Error("Expected a deny decision.");
    }
    expect(decision.statusCode).toBe(401);
  });
});

describe("authorizeIdentity", () => {
  const identity = {
    login: "alice@example.com",
    displayName: "Alice Example",
    userId: "42",
    nodeId: "99",
    nodeName: "alice-mbp",
    tailnet: "example.com",
  };

  it("allows matching logins", () => {
    const decision = authorizeIdentity(identity, "100.64.0.10", ["@example.com"]);

    expect(decision.ok).toBe(true);
  });

  it("denies logins outside the allowed suffix list", () => {
    const decision = authorizeIdentity(identity, "100.64.0.10", ["@corp.example"]);

    expect(decision.ok).toBe(false);
    if (decision.ok) {
      throw new Error("Expected a deny decision.");
    }
    expect(decision.statusCode).toBe(403);
  });
});

describe("buildAuthHeaders", () => {
  it("includes the expected upstream headers", () => {
    const headers = buildAuthHeaders({
      login: "alice@example.com",
      displayName: "Alice Example",
      userId: "42",
      nodeId: "99",
      nodeName: "alice-mbp",
      tailnet: "example.com",
    });

    expect(headers["X-Auth-User"]).toBe("alice@example.com");
    expect(headers["X-Tailscale-Node-Name"]).toBe("alice-mbp");
    expect(headers["X-Tailscale-Tailnet"]).toBe("example.com");
  });
});
