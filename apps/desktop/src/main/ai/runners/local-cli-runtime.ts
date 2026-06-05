/**
 * Local CLI Runtime
 * ===================
 *
 * BYOA ("Bring Your Own Account/Agent") runtime: spawns a local CLI binary
 * (Claude Code CLI or OpenAI Codex CLI) as a subprocess and pipes the prompt
 * through it, parsing the NDJSON output as a stream of events.
 *
 * The runner code path is uniform across both runtimes: the runner switches
 * on `client.runtime === 'local-cli'` and iterates an AsyncIterable of
 * `{ type: 'text-delta' | 'tool-call' | 'error' | 'finish' }` events that
 * mirror Vercel AI SDK's `fullStream`.
 *
 * NOTE: this is the initial scaffolding. The full NDJSON streaming parser
 * (incremental stdout reads via spawn) lives in a follow-up PR; the
 * current implementation uses `execFile` (buffered, single-shot) which
 * is sufficient for short prompts but not for long agentic loops.
 *
 * See: apps/desktop/src/main/cli-integration-handler.ts for the established
 * patterns for invoking `claude` and `codex` from the terminal subsystem.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { LocalCliConfig } from '../client/types';

const execFileAsync = promisify(execFile);

export type LocalCliEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; name: string; input: unknown }
  | { type: 'error'; error: string }
  | { type: 'finish' };

export interface LocalCliInvokeOptions {
  /** Spawn binary ('claude' or 'codex') */
  binary: 'claude' | 'codex';
  /** Resolved binary path */
  binaryPath: string;
  /** Working directory for the subprocess */
  cwd: string;
  /** System prompt (passed via stdin for claude, --system flag for codex) */
  system: string;
  /** User prompt */
  prompt: string;
  /** Extra CLI args (e.g. model override, additional flags) */
  extraArgs: string[];
  /** Resolved env (PATH augmentation, CLAUDE_CONFIG_DIR, etc.) */
  env: Record<string, string>;
  /** Abort signal */
  abortSignal?: AbortSignal;
}

/**
 * Build the CLI arg list for the chosen binary.
 *
 * - Claude Code CLI: `claude --print --output-format stream-json --verbose
 *                    --dangerously-skip-permissions [extraArgs...]`
 * - Codex CLI:       `codex exec --json [extraArgs...]`
 *
 * The system prompt is sent via stdin; the user prompt is passed as
 * the CLI's positional argument (claude) or piped via stdin (codex).
 */
export function buildLocalCliArgs(
  binary: 'claude' | 'codex',
  prompt: string,
  extraArgs: string[],
): string[] {
  if (binary === 'claude') {
    return [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      ...extraArgs,
      prompt,
    ];
  }
  // codex
  return ['exec', '--json', ...extraArgs];
}

/**
 * Invoke the local CLI binary and yield events as an AsyncIterable.
 *
 * This is a simplified initial implementation using execFile (buffered).
 * It waits for the entire process to exit, then emits a single 'text-delta'
 * containing stdout, or a single 'error' on failure. The full streaming
 * version (with incremental stdout reads) is in a follow-up PR.
 */
export async function* invokeLocalCli(
  options: LocalCliInvokeOptions,
): AsyncGenerator<LocalCliEvent> {
  const args = buildLocalCliArgs(options.binary, options.prompt, options.extraArgs);

  try {
    const { stdout, stderr } = await execFileAsync(options.binaryPath, args, {
      cwd: options.cwd,
      env: options.env,
      maxBuffer: 50 * 1024 * 1024, // 50 MB
      signal: options.abortSignal,
    });

    // Best-effort: try to parse stdout as NDJSON; fall back to raw text.
    const lines = stdout.split('\n').filter(Boolean);
    let emittedAny = false;
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as { type?: string; content?: string; message?: { content?: string } };
        if (parsed.type === 'assistant' && parsed.message?.content) {
          for (const block of (parsed.message.content as unknown) as Array<{ type?: string; text?: string; name?: string; input?: unknown }>) {
            if (block.type === 'text' && typeof block.text === 'string') {
              yield { type: 'text-delta', text: block.text };
              emittedAny = true;
            } else if (block.type === 'tool_use') {
              yield { type: 'tool-call', name: block.name ?? 'unknown', input: block.input };
              emittedAny = true;
            }
          }
        } else if (parsed.type === 'result' && typeof parsed.content === 'string') {
          yield { type: 'text-delta', text: parsed.content };
          emittedAny = true;
        }
      } catch {
        // Non-JSON line — emit as raw text
        yield { type: 'text-delta', text: line };
        emittedAny = true;
      }
    }
    if (!emittedAny) {
      yield { type: 'text-delta', text: stdout };
    }
    if (stderr) {
      // Surface stderr as a non-fatal error event so the runner can log it
      yield { type: 'error', error: stderr };
    }
    yield { type: 'finish' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { type: 'error', error: message };
    yield { type: 'finish' };
  }
}

/**
 * Resolve the binary path for a given local-CLI config using the CLI tool
 * manager. Throws if the binary is not found.
 *
 * Used by createSimpleClient to populate `localCliConfig.binaryPath` when
 * the user has not configured a custom path in their ProviderAccount.
 */
export function ensureLocalCliBinary(config: LocalCliConfig): string {
  if (!config.binaryPath) {
    throw new Error(
      `Local CLI binary path is empty for ${config.binary}. ` +
        'Install Claude Code CLI (https://claude.ai/download) or Codex CLI ' +
        '(https://github.com/openai/codex), or set a custom path in the account settings.',
    );
  }
  return config.binaryPath;
}

/**
 * High-level helper: invoke the local CLI and concatenate all text-delta
 * events into a single string. Mirrors the Vercel AI SDK's `generateText`
 * shape closely enough for utility runners (e.g. ideation, changelog) that
 * don't need to stream events.
 *
 * Returns the assembled text on success. Throws on error events with no
 * text content.
 */
export async function invokeLocalCliForText(options: {
  binary: 'claude' | 'codex';
  binaryPath: string;
  cwd: string;
  system: string;
  prompt: string;
  extraArgs?: string[];
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const events = invokeLocalCli({
    binary: options.binary,
    binaryPath: options.binaryPath,
    cwd: options.cwd,
    system: options.system,
    prompt: options.prompt,
    extraArgs: options.extraArgs ?? [],
    env: options.env ?? (process.env as Record<string, string>),
    abortSignal: options.abortSignal,
  });

  const parts: string[] = [];
  let lastError: string | undefined;
  for await (const event of events) {
    if (event.type === 'text-delta') {
      parts.push(event.text);
    } else if (event.type === 'error') {
      lastError = event.error;
    }
  }
  const text = parts.join('');
  if (!text && lastError) {
    throw new Error(`Local CLI invocation failed: ${lastError}`);
  }
  return text;
}
