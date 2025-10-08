/**
 * Common test utilities for putrecord tests
 *
 * This module provides cross-platform helpers for:
 * - Temporary directory management with proper path handling
 * - E2E configuration loading
 * - Command execution
 * - Common cleanup patterns
 */

import { join } from "@std/path";

/**
 * Creates a temporary directory for testing with a specific prefix.
 *
 * @param prefix - Prefix for the temporary directory name
 * @returns The absolute path to the created directory
 */
export async function createTestDir(prefix: string): Promise<string> {
  const tempDir = await Deno.makeTempDir({ prefix });
  return tempDir;
}

/**
 * Cleans up a test directory, ignoring any errors.
 * Safe to call even if the directory doesn't exist.
 *
 * @param dir - The directory path to remove
 */
export async function cleanupTestDir(dir: string): Promise<void> {
  try {
    await Deno.remove(dir, { recursive: true });
  } catch {
    // Ignore cleanup errors - directory might not exist or be inaccessible
  }
}

/**
 * Joins path segments using the OS-appropriate separator.
 * This ensures cross-platform compatibility between Unix and Windows.
 *
 * @param basePath - The base directory path
 * @param segments - Path segments to join
 * @returns The joined path with proper separators for the current OS
 *
 * @example
 * ```ts
 * // On Unix: /tmp/test/.github/workflows/file.yaml
 * // On Windows: C:\Temp\test\.github\workflows\file.yaml
 * const path = joinPath(tempDir, ".github", "workflows", "file.yaml");
 * await Deno.writeTextFile(path, "content");
 * ```
 */
export function joinPath(basePath: string, ...segments: string[]): string {
  return join(basePath, ...segments);
}

/**
 * Loads E2E configuration from .env.e2e file.
 * Returns null if the file doesn't exist (tests will be skipped).
 *
 * @returns Environment variables object, or null if .env.e2e doesn't exist
 * @throws If .env.e2e exists but is missing required variables
 */
export async function loadE2EConfig(): Promise<
  Record<
    string,
    string
  > | null
> {
  try {
    // Check if .env.e2e exists
    await Deno.stat(".env.e2e");

    // Load .env.e2e file
    const envContent = await Deno.readTextFile(".env.e2e");
    const lines = envContent.split("\n");

    const envVars: Record<string, string> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim();
          envVars[key.trim()] = value;
        }
      }
    }

    // Verify required credentials are present
    const required = ["PDS_URL", "IDENTIFIER", "APP_PASSWORD"];
    for (const key of required) {
      if (!envVars[key]) {
        throw new Error(`Missing ${key} in .env.e2e`);
      }
    }

    return envVars;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw error;
  }
}

/**
 * Runs a command and captures its output.
 * Useful for testing CLI commands.
 *
 * @param command - The command to run (e.g., "deno")
 * @param args - Array of command arguments
 * @param options - Additional options (cwd, env, etc.)
 * @returns Object with success flag, stdout, and stderr
 *
 * @example
 * ```ts
 * const result = await runCommand("deno", ["run", "main.ts"], { cwd: tempDir });
 * expect(result.success).toBe(true);
 * ```
 */
export async function runCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
  },
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const cmd = new Deno.Command(command, {
    args,
    cwd: options?.cwd,
    env: options?.env,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();

  return {
    success: code === 0,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

/**
 * Helper for tests that need to wait for async operations to complete.
 * Commonly used in E2E tests for PDS record propagation.
 *
 * @param ms - Milliseconds to wait
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run the putrecord CLI command and capture output.
 * Specifically for testing the CLI end-to-end.
 *
 * @param args - CLI arguments (e.g., ["--force-fields"])
 * @param env - Environment variables to pass to the command
 * @returns Object with success flag, stdout, and stderr
 *
 * @example
 * ```ts
 * const result = await runCLI(["--force-fields"], {
 *   PDS_URL: "https://bsky.social",
 *   IDENTIFIER: "user.bsky.social",
 *   APP_PASSWORD: "xxxx",
 *   COLLECTION: "com.whtwnd.blog.entry",
 *   FILE_PATH: "/path/to/file.md",
 * });
 * expect(result.success).toBe(true);
 * ```
 */
export async function runCLI(
  args: string[],
  env?: Record<string, string>,
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return await runCommand("deno", [
    "run",
    "--allow-all",
    "src/main.ts",
    ...args,
  ], {
    env,
  });
}

// ============================================================================
// E2E Test Utilities for AT Protocol / PDS Operations
// ============================================================================
//
// setupE2EClient() handles authentication boilerplate so E2E tests don't need
// to repeat credential manager and login logic. Tests should make AT Protocol
// API calls directly using the returned client to keep test intent clear.
// ============================================================================

// Import AT Protocol types only when this module is used in E2E tests
import type { Client } from "@atcute/client";

/**
 * Setup an authenticated AT Protocol client using environment variables.
 * This is a convenience wrapper to avoid repeating authentication boilerplate
 * in every E2E test.
 *
 * @param envVars - Environment variables from loadE2EConfig()
 * @returns Authenticated client and identifier
 * @throws If required environment variables are missing
 *
 * @example
 * ```ts
 * const envVars = await loadE2EConfig();
 * if (envVars) {
 *   const { client, identifier } = await setupE2EClient(envVars);
 *   // Use client for PDS operations
 * }
 * ```
 */
export async function setupE2EClient(
  envVars: Record<string, string>,
): Promise<{ client: Client; identifier: string }> {
  const { CredentialManager, Client } = await import("@atcute/client");

  const pdsUrl = envVars["PDS_URL"];
  const identifier = envVars["IDENTIFIER"];
  const password = envVars["APP_PASSWORD"];

  if (!pdsUrl || !identifier || !password) {
    throw new Error(
      "Missing required E2E configuration: PDS_URL, IDENTIFIER, or APP_PASSWORD",
    );
  }

  const manager = new CredentialManager({ service: pdsUrl });
  const client = new Client({ handler: manager });

  await manager.login({
    identifier,
    password,
  });

  return { client, identifier };
}
