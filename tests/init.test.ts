/**
 * Unit tests for the init command
 */

import { expect } from "@std/expect";
import { ENV_EXAMPLE_TEMPLATE, WORKFLOW_TEMPLATE } from "../src/templates.ts";
import {
  cleanupTestDir,
  createTestDir,
  mkdirTestPath,
  readTestFile,
  statTestPath,
  writeTestFile,
} from "./test_utils.ts";

/**
 * Helper to create a temporary test directory
 */
async function createTempDir(): Promise<string> {
  return await createTestDir("putrecord_test_");
}

/**
 * Helper to clean up test directory
 */
async function cleanupDir(dir: string) {
  await cleanupTestDir(dir);
}

/**
 * Helper to run init command in a directory
 */
async function runInit(
  dir: string,
  args: string[] = [],
): Promise<{ success: boolean; output: string }> {
  // Get absolute path to main.ts from the project root
  const projectRoot = new URL("../", import.meta.url).pathname;
  const mainPath = `${projectRoot}src/main.ts`;

  const cmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      mainPath,
      "init",
      ...args,
    ],
    cwd: dir,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  const errorOutput = new TextDecoder().decode(stderr);

  return {
    success: code === 0,
    output: code === 0 ? output : errorOutput,
  };
}

Deno.test("init - should create workflow directory", async () => {
  const tempDir = await createTempDir();

  try {
    const result = await runInit(tempDir);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Created directory: .github/workflows");

    // Verify directory exists
    const stat = await statTestPath(tempDir, [".github", "workflows"]);
    expect(stat.isDirectory).toBe(true);
  } finally {
    await cleanupDir(tempDir);
  }
});

Deno.test("init - should create workflow file with correct content", async () => {
  const tempDir = await createTempDir();

  try {
    const result = await runInit(tempDir);

    expect(result.success).toBe(true);
    expect(result.output).toContain(
      "Created: .github/workflows/putrecord.yaml",
    );

    // Verify file exists and has correct content
    const content = await readTestFile(tempDir, [
      ".github",
      "workflows",
      "putrecord.yaml",
    ]);
    expect(content).toBe(WORKFLOW_TEMPLATE);
  } finally {
    await cleanupDir(tempDir);
  }
});

Deno.test("init - should create .env.example with correct content", async () => {
  const tempDir = await createTempDir();

  try {
    const result = await runInit(tempDir);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Created: .env.example");

    // Verify file exists and has correct content
    const content = await readTestFile(tempDir, [".env.example"]);
    expect(content).toBe(ENV_EXAMPLE_TEMPLATE);
  } finally {
    await cleanupDir(tempDir);
  }
});

Deno.test("init - should show success message with next steps", async () => {
  const tempDir = await createTempDir();

  try {
    const result = await runInit(tempDir);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Initialization complete!");
    expect(result.output).toContain("Next steps:");
    expect(result.output).toContain("Copy .env.example to .env");
    expect(result.output).toContain("Set GitHub repository secrets");
  } finally {
    await cleanupDir(tempDir);
  }
});

Deno.test("init - should skip existing workflow file without --force", async () => {
  const tempDir = await createTempDir();

  try {
    // First init
    await runInit(tempDir);

    // Second init without --force
    const result = await runInit(tempDir);

    expect(result.success).toBe(true);
    expect(result.output).toContain(
      "Skipped: .github/workflows/putrecord.yaml (already exists)",
    );
    expect(result.output).toContain("Use --force to overwrite");
  } finally {
    await cleanupDir(tempDir);
  }
});

Deno.test("init - should skip existing .env.example without --force", async () => {
  const tempDir = await createTempDir();

  try {
    // First init
    await runInit(tempDir);

    // Second init without --force
    const result = await runInit(tempDir);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Skipped: .env.example (already exists)");
    expect(result.output).toContain("Use --force to overwrite");
  } finally {
    await cleanupDir(tempDir);
  }
});

Deno.test("init - should overwrite workflow file with --force", async () => {
  const tempDir = await createTempDir();

  try {
    // First init
    await runInit(tempDir);

    // Modify the workflow file
    await writeTestFile(
      tempDir,
      [".github", "workflows", "putrecord.yaml"],
      "modified content",
    );

    // Second init with --force
    const result = await runInit(tempDir, ["--force"]);

    expect(result.success).toBe(true);
    expect(result.output).toContain(
      "Created: .github/workflows/putrecord.yaml (overwritten)",
    );

    // Verify content is restored to template
    const content = await readTestFile(tempDir, [
      ".github",
      "workflows",
      "putrecord.yaml",
    ]);
    expect(content).toBe(WORKFLOW_TEMPLATE);
  } finally {
    await cleanupDir(tempDir);
  }
});

Deno.test("init - should overwrite .env.example with --force", async () => {
  const tempDir = await createTempDir();

  try {
    // First init
    await runInit(tempDir);

    // Modify the .env.example file
    await writeTestFile(tempDir, [".env.example"], "modified content");

    // Second init with --force
    const result = await runInit(tempDir, ["--force"]);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Created: .env.example (overwritten)");

    // Verify content is restored to template
    const content = await readTestFile(tempDir, [".env.example"]);
    expect(content).toBe(ENV_EXAMPLE_TEMPLATE);
  } finally {
    await cleanupDir(tempDir);
  }
});

Deno.test("init - should work when .github directory already exists", async () => {
  const tempDir = await createTempDir();

  try {
    // Pre-create .github directory
    await mkdirTestPath(tempDir, [".github"]);

    const result = await runInit(tempDir);

    expect(result.success).toBe(true);
    expect(result.output).toContain(
      "Created: .github/workflows/putrecord.yaml",
    );

    // Verify workflow file was created
    const stat = await statTestPath(tempDir, [
      ".github",
      "workflows",
      "putrecord.yaml",
    ]);
    expect(stat.isFile).toBe(true);
  } finally {
    await cleanupDir(tempDir);
  }
});

Deno.test("init - should work when .github/workflows directory already exists", async () => {
  const tempDir = await createTempDir();

  try {
    // Pre-create .github/workflows directory
    await mkdirTestPath(tempDir, [".github", "workflows"], { recursive: true });

    const result = await runInit(tempDir);

    expect(result.success).toBe(true);
    // Note: mkdir with recursive: true doesn't differentiate between creating and existing
    // Either "Created directory" or "Directory exists" is acceptable here
    expect(result.output).toContain(".github/workflows");
    expect(result.output).toContain(
      "Created: .github/workflows/putrecord.yaml",
    );
  } finally {
    await cleanupDir(tempDir);
  }
});

Deno.test("init - should handle quiet mode", async () => {
  const tempDir = await createTempDir();

  try {
    const result = await runInit(tempDir, ["--quiet"]);

    expect(result.success).toBe(true);
    // In quiet mode, should have minimal output (only errors or critical info)
    expect(result.output).not.toContain("Initializing putrecord project");
  } finally {
    await cleanupDir(tempDir);
  }
});
