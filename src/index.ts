import { createApp } from "./runtime/app";
import { getRuntimeConfig } from "./runtime/env";

const config = getRuntimeConfig();
const app = createApp(config).listen({
  hostname: config.host,
  port: config.port,
});

console.log(
  `tailscale-auth listening on http://${app.server?.hostname}:${app.server?.port}${config.authPath}`,
);
