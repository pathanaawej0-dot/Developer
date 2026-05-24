export interface CliFlags {
  session?: string;
  model?: string;
}

export function parseCliFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {};

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--session" && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      flags.session = argv[++i];
    } else if (argv[i] === "--model" && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      flags.model = argv[++i];
    }
  }

  return flags;
}
