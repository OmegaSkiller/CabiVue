import { readConfig } from './config.js';
import { createApp } from './app.js';
const config = readConfig();
const instance = createApp(config);
const server = instance.app.listen(config.port, '0.0.0.0', () =>
  console.log(`Cabivue listening on port ${config.port}`),
);
server.requestTimeout = 90000;
server.headersTimeout = 15000;
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    server.close(() => {
      instance.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
