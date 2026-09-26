import { createPgPool, loadEnv } from "@kawaipay/shared";
import { loadConfig } from "./config.js";
import { HttpFacilitatorClient } from "./facilitatorClient.js";
import { buildApp } from "./app.js";

loadEnv();
const config = loadConfig();
const pg = createPgPool(config.databaseUrl);
const facilitator = new HttpFacilitatorClient(config.facilitatorUrl);

const app = buildApp({ pg, facilitator, config });

app
  .listen({ port: config.port, host: "0.0.0.0" })
  .then(() => console.log(JSON.stringify({ msg: "oracle-api listening", port: config.port })))
  .catch((err) => {
    console.error(JSON.stringify({ msg: "oracle-api failed to start", error: err instanceof Error ? err.message : String(err) }));
    process.exit(1);
  });
