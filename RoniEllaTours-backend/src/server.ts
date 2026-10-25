import { createServer } from 'node:http';
import { loadConfig, ConfigurationError } from './config.js';
import { createHandler } from './http.js';

try {
  const config = loadConfig(process.env);
  const server = createServer(createHandler({ config }));
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(config.PORT, '127.0.0.1', () => console.info(`Backend listening on http://127.0.0.1:${config.PORT} (${config.EMAIL_PROVIDER})`));
} catch (error) {
  console.error(error instanceof ConfigurationError ? error.message : 'Backend startup failed.');
  process.exitCode = 1;
}
