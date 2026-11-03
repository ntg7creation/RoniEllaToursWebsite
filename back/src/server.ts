import { createApp } from "./app.js";
import { LocalContentRepository } from "./content-repository.js";
import { SupabaseContentRepository } from "./supabase-repository.js";
import { readBackendConfig } from "./config.js";
import {configuredCallbackMailer} from "./callback-email.js";
try {
  const config = readBackendConfig();
  const repository = config.provider === "supabase" ? new SupabaseContentRepository(config)
    : await LocalContentRepository.load(config.contentDirectory);
  await repository.getPublicContent();
  const server = createApp(repository, { apiToken: config.apiToken,callbackMailer:configuredCallbackMailer() }).listen(config.port, config.host, () =>
    console.log(`Content API listening on ${config.host}:${config.port} (${config.provider})`),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref();
    });
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Content startup failed",
  );
  process.exitCode = 1;
}
