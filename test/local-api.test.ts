import { describe, expect, mock, test } from "bun:test";

const requestMock = mock(() => {
  throw new Error("request mock not initialized");
});

mock.module("node:http", () => ({
  request: requestMock,
}));

const { lookupTailscaleIdentity } = await import("../src/tailscale/local-api");

describe("lookupTailscaleIdentity", () => {
  test("uses the local-tailscaled.sock host for unix socket requests", async () => {
    requestMock.mockImplementation((options, callback) => {
      expect(options).toMatchObject({
        socketPath: "/var/run/tailscale/tailscaled.sock",
        path: "/localapi/v0/whois?addr=100.64.0.10%3A0",
        method: "GET",
        headers: {
          Accept: "application/json",
          Host: "local-tailscaled.sock",
        },
      });

      const response = {
        statusCode: 200,
        on(event: string, handler: (value?: unknown) => void) {
          if (event === "data") {
            handler(
              Buffer.from(
                JSON.stringify({
                  UserProfile: {
                    LoginName: "alice@example.com",
                    DisplayName: "Alice Example",
                    ID: 42,
                  },
                  Node: {
                    ID: 99,
                    ComputedName: "alice-mbp",
                  },
                }),
              ),
            );
          }

          if (event === "end") {
            handler();
          }

          return this;
        },
      };

      callback(response);

      return {
        on() {
          return this;
        },
        end() {},
      };
    });

    await expect(
      lookupTailscaleIdentity("/var/run/tailscale/tailscaled.sock", "100.64.0.10"),
    ).resolves.toMatchObject({
      login: "alice@example.com",
      nodeName: "alice-mbp",
      tailnet: "example.com",
    });
  });

  test("treats a 404 whois response as no matching identity", async () => {
    requestMock.mockImplementation((options, callback) => {
      expect(options).toMatchObject({
        path: "/localapi/v0/whois?addr=83.250.157.218%3A0",
      });

      const response = {
        statusCode: 404,
        on(event: string, handler: (value?: unknown) => void) {
          if (event === "data") {
            handler(Buffer.from("no match for IP:port\n"));
          }

          if (event === "end") {
            handler();
          }

          return this;
        },
      };

      callback(response);

      return {
        on() {
          return this;
        },
        end() {},
      };
    });

    await expect(
      lookupTailscaleIdentity("/var/run/tailscale/tailscaled.sock", "83.250.157.218"),
    ).resolves.toBeNull();
  });
});
