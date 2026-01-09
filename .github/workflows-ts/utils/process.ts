/**
 * Process spawning utilities
 * Provides reusable functions for spawning external processes with logging
 */

import type { Logger } from './logger';

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  logCommand?: boolean;
  logOutput?: boolean;
}

/**
 * Spawn a process and capture output
 * Provides consistent handling of stdout/stderr and exit codes
 */
export async function spawnProcess(
  command: string[],
  logger: Logger,
  options: SpawnOptions = {}
): Promise<SpawnResult> {
  const { cwd, env, logCommand = true, logOutput = false } = options;

  if (logCommand) {
    logger.debug(`Running: ${command.join(' ')}`);
  }

  const proc = Bun.spawn(command, {
    cwd: cwd || process.cwd(),
    env: env ? { ...process.env, ...env } : process.env,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (logOutput && stdout) {
    logger.debug(`stdout: ${stdout.trim()}`);
  }

  if (stderr && exitCode !== 0) {
    logger.debug(`stderr: ${stderr.trim()}`);
  }

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
    success: exitCode === 0,
  };
}

/**
 * Spawn a gh CLI command with proper authentication
 */
export async function spawnGhCommand(
  args: string[],
  token: string,
  logger: Logger,
  options: SpawnOptions = {}
): Promise<SpawnResult> {
  return spawnProcess(
    ['gh', ...args],
    logger,
    {
      ...options,
      env: {
        ...options.env,
        GH_TOKEN: token,
        GITHUB_TOKEN: token,
      },
    }
  );
}

/**
 * Spawn a git command
 */
export async function spawnGitCommand(
  args: string[],
  logger: Logger,
  options: SpawnOptions = {}
): Promise<SpawnResult> {
  return spawnProcess(['git', ...args], logger, options);
}
