# 0001 — In-process Architecture

The agent loop and Ink UI run in the same Node process. Tool results are passed via in-memory references. Events flow through a local pub/sub bus.

The alternative was OpenCode's client-server model: an HTTP server with SSE streaming enabling multi-client access (TUI, web UI, remote connections). That adds transport serialization, connection management, and process lifecycle complexity.

We chose in-process because this is a practice project — multi-client support is not a goal. The cost of separation (SSE marshalling, server startup latency, port management) outweighs the benefit. If multi-client ever becomes needed, the event bus abstraction makes extraction straightforward without pre-paying for it.

Status: accepted
