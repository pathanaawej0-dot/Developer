import { render } from "ink";
import App from "./ui/app.js";
import { createEventBus } from "./event-bus/index.js";
import { createSessionStore } from "./session-store/index.js";
import { createProvider } from "./agent/provider.js";
import { createAgent } from "./agent/loop.js";
import { createToolRegistry } from "./tools/registry.js";
import { createFileTool } from "./tools/file.js";
import { createBashTool } from "./tools/bash.js";
import { createProcessTool } from "./tools/process.js";
import { parseCliFlags } from "./cli/parse-flags.js";

const flags = parseCliFlags(process.argv.slice(2));
const eventBus = createEventBus();
const sessionStore = createSessionStore();

async function main() {
  let session;
  if (flags.session) {
    try {
      session = await sessionStore.loadSession(flags.session);
    } catch {
      console.error(`Session not found: ${flags.session}`);
      process.exit(1);
    }
  } else {
    session = await sessionStore.createSession();
  }

  if (!process.env.KILO_API_KEY) {
    console.error("Warning: KILO_API_KEY not set. Running in anonymous mode with free models (rate limited to 200 req/hr).");
  }

  const provider = createProvider({ model: flags.model });
  const registry = createToolRegistry();

  registry.register(createFileTool());
  registry.register(createBashTool());
  registry.register(createProcessTool());

  const agent = createAgent({
    provider,
    eventBus,
    sessionStore,
    sessionId: session.id,
    registry,
  });

  render(
    <App
      eventBus={eventBus}
      modelName={flags.model}
      onSubmit={(value) => agent.run(value)}
    />,
  );
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
