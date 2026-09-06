import { configuration, startCommand } from './runtime.mjs';

const config = configuration(process.env.N8N_USER_FOLDER);
const running = startCommand(['start'], config);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => running.child.kill(signal));
const result = await running.completed;
process.exitCode = result.code ?? 1;
