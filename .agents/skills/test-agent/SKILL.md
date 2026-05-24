---
name: test-agent
description: >
  Test the agent loop end-to-end by running a real prompt through the full
  pipeline (LLM provider, tool registry, agent loop). Triggered when user says
  "/test-agent", "test agent", or asks to test/run the agent with a prompt.
---

## How to use

When user invokes `/test-agent <prompt>` or says "test agent with <prompt>":

1. Extract the prompt from the user's message
2. Run `pnpm agent "<prompt>"` using the Bash tool
3. Return the full output to the user

## Usage

```
/test-agent write a file called hello.txt with content 'Hello'
/test-agent list files in current directory
/test-agent create a file then read it
```

## Output format

The command streams real-time output:

```
━━━ Agent Test Run ━━━━━━━━━━━━━━━...

Prompt: write a file called hello.txt

[THINKING] Processing...
[TOOL:START] file
  Args: { "action": "write", ... }
[TOOL:END]   file ✓
  Written hello.txt (21 bytes)
Here is the result...
[DONE]

━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━...
  Tokens:    14
  Duration:  4.6s
  Workspace: /tmp/agent-test-xxx/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━...
```

## Notes

- Requires `KILO_API_KEY` to be set (env var or `.env.local`)
- Creates a temp workspace that is NOT cleaned up after run
- Timeout: allow up to 120s for agent to complete
- Works with any prompt the agent loop can handle
