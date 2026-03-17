# tailscale-auth

Small Traefik `forwardAuth` service for apps that are only treated as authenticated when the request arrived over Tailscale.

The service looks up the original client IP through Tailscale LocalAPI `whois` and returns upstream headers when that IP maps to a real Tailscale user.

## Behavior

- `200` means allow the request.
- `401` means the request was not tied to a Tailscale user.
- `403` means the user was resolved but failed the configured suffix policy.
- `502` means the service could not talk to `tailscaled`.

## Environment

- `HOST`: bind host. Default `0.0.0.0`
- `PORT`: bind port. Default `3000`
- `AUTH_PATH`: Traefik auth endpoint. Default `/traefik/auth`
- `HEALTH_PATH`: health endpoint. Default `/healthz`
- `TAILSCALE_SOCKET_PATH`: LocalAPI socket. Default `/var/run/tailscale/tailscaled.sock`
- `ALLOWED_LOGIN_SUFFIXES`: optional comma-separated suffix allowlist such as `@company.com,@contractor.company.com`
- `PERMISSIVE_PATH_PREFIXES`: optional comma-separated forwarded URI prefixes that should pass through with `200` when no Tailscale identity is present, for example `/api/auth/tailscale`
- `LOG_REQUESTS`: `true` or `false`. Default `true`

## Returned Headers

- `X-Auth-User`
- `X-Auth-Name`
- `X-Tailscale-User-Login`
- `X-Tailscale-User-Name`
- `X-Tailscale-User-Id`
- `X-Tailscale-Node-Id`
- `X-Tailscale-Node-Name`
- `X-Tailscale-Tailnet`

Configure Traefik to pass those headers upstream with `authResponseHeaders`.

## Local Run

```bash
bun install
bun run dev
```

## Docker

Mount the host `tailscaled` socket into the container:

```yaml
services:
  tailscale-auth:
    build: .
    environment:
      PORT: "3000"
      ALLOWED_LOGIN_SUFFIXES: "@company.com"
      PERMISSIVE_PATH_PREFIXES: "/api/auth/tailscale"
    volumes:
      - /var/run/tailscale/tailscaled.sock:/var/run/tailscale/tailscaled.sock:ro
```

## Traefik Example

```yaml
labels:
  - traefik.http.middlewares.tailscale-auth.forwardauth.address=http://tailscale-auth:3000/traefik/auth
  - traefik.http.middlewares.tailscale-auth.forwardauth.trustForwardHeader=true
  - traefik.http.middlewares.tailscale-auth.forwardauth.authResponseHeaders=X-Auth-User,X-Auth-Name,X-Tailscale-User-Login,X-Tailscale-User-Name,X-Tailscale-User-Id,X-Tailscale-Node-Id,X-Tailscale-Node-Name,X-Tailscale-Tailnet
  - traefik.http.routers.app.middlewares=tailscale-auth@docker
```

Keep the auth service off the public internet. Traefik should be the only caller.

For Better Auth bootstrap routes such as `/api/auth/tailscale`, set `PERMISSIVE_PATH_PREFIXES=/api/auth/tailscale` so non-tailnet users can fall through to your app and get redirected to manual sign-in instead of seeing Traefik's raw `401`.

## Container Publishing

[`publish-container.yml`](./.github/workflows/publish-container.yml) builds and
publishes the runtime image as `git.dgren.dev/<owner>/tailscale-auth`.

Set these repository variables and secrets before enabling the workflow:

- `GITEA_INSTANCE_URL`: optional checkout/source URL override, for example `https://git.dgren.dev`
- `REGISTRY_TOKEN`: Gitea personal access token with package write access
- `REGISTRY_USERNAME`: optional override for the registry login account

On `main`, the workflow publishes `latest`, `main`, and `sha-<commit>` tags. Tag
pushes also publish the Git tag name.
