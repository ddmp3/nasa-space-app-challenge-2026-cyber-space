import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { loadMoonReference, loadOpenApi, loadSites } from "./load.js";
import { buildSources } from "../sources/index.js";

const log = (message: string, error?: unknown): void => {
  const detail = error instanceof Error ? ` (${error.name}: ${error.message})` : "";
  console.error(`[api] ${message}${detail}`);
};

async function main(): Promise<void> {
  const config = readConfig();
  const sites = await loadSites(config.dataDir, (note) => log(note));
  const sources = await buildSources(config.dataDir, config.useFixtures);
  sources.notes.forEach((note) => log(note));
  if (sites.length === 0) log("Aucun site chargé : /api/analyze renverra une liste vide");

  const app = createApp({
    sites,
    connectors: sources.connectors,
    sourceNames: sources.names,
    useFixtures: config.useFixtures,
    openapi: await loadOpenApi(),
    moonReference: await loadMoonReference(config.dataDir),
    allowedOrigins: config.allowedOrigins,
    rateLimitPerMinute: config.rateLimitPerMinute,
    onConnectorError: (error, site) => log(`connecteur en échec pour ${site.id}`, error),
    log,
  });

  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`[api] ${sites.length} sites, sources : ${sources.names.join(", ")} — http://0.0.0.0:${config.port}/api/docs`);
  });
  const stop = (): void => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((error: unknown) => {
  log("Démarrage impossible", error);
  process.exit(1);
});
