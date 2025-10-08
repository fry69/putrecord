# Test Utilities Documentation

## Overview

The `tests/test_utils.ts` module provides cross-platform test helpers that
ensure tests work correctly on both Unix-like systems (macOS, Linux) and
Windows. These utilities solve common testing challenges, particularly around
path handling and temporary directory management.

## The Windows Path Problem

### What Was the Issue?

The `init` tests were failing on Windows with errors like:

```
error: NotFound: The system cannot find the path specified. (os error 3):
writefile 'C:\Users\...\Temp\putrecord_test_xxx/.github/workflows/putrecord.yaml'
```

Notice the mixed path separators: Windows prefix `C:\Users\...\Temp\` followed
by Unix-style forward slashes `/.github/workflows/`.

### Why Only Init Tests Failed

The `init` tests create **nested directory structures**
(`.github/workflows/putrecord.yaml`), while other tests only created files
directly in the temp directory root:

- **Failed**: `${tempDir}/.github/workflows/putrecord.yaml` (nested paths)
- **Worked**: `${tempDir}/test-file.txt` (single level)

On Windows, Deno's `makeTempDir()` returns a path with backslashes (e.g.,
`C:\Users\...\Temp\xyz`), but when you concatenate with forward slashes using
template literals, you get malformed paths.

### The Solution

Use Deno's standard library `@std/path` module's `join()` function, which
automatically uses the correct path separator for the current operating system:

```typescript
// ❌ WRONG - Hardcoded forward slashes
const path = `${tempDir}/.github/workflows/file.yaml`;

// ✅ RIGHT - OS-appropriate separators
import { join } from "@std/path";
const path = join(tempDir, ".github", "workflows", "file.yaml");
```

## API Reference

### Path Handling

#### `joinPath(basePath: string, ...segments: string[]): string`

Joins path segments using OS-appropriate separators.

```typescript
// Unix: /tmp/test/.github/workflows/file.yaml
// Windows: C:\Temp\test\.github\workflows\file.yaml
const path = joinPath(tempDir, ".github", "workflows", "file.yaml");
```

**Why use this instead of `join` directly?**

- Provides a clear, test-focused API
- Consistent naming with other test utilities
- Can be extended with test-specific behavior if needed

### Directory Management

#### `createTestDir(prefix: string): Promise<string>`

Creates a temporary directory for testing.

```typescript
const tempDir = await createTestDir("putrecord_test_");
// Returns: /tmp/putrecord_test_abc123 (or Windows equivalent)
```

#### `cleanupTestDir(dir: string): Promise<void>`

Safely removes a test directory, ignoring errors if it doesn't exist.

```typescript
try {
  const tempDir = await createTestDir("test_");
  // ... test code ...
} finally {
  await cleanupTestDir(tempDir); // Always safe to call
}
```

### File Operations

These helpers automatically use OS-appropriate path separators:

#### `writeTestFile(basePath: string, segments: string[], content: string): Promise<void>`

```typescript
await writeTestFile(tempDir, [".github", "workflows", "test.yaml"], "content");
// Creates and writes to: {tempDir}/.github/workflows/test.yaml
```

#### `readTestFile(basePath: string, segments: string[]): Promise<string>`

```typescript
const content = await readTestFile(tempDir, [".env.example"]);
```

#### `statTestPath(basePath: string, segments: string[]): Promise<Deno.FileInfo>`

```typescript
const stats = await statTestPath(tempDir, [".github", "workflows"]);
expect(stats.isDirectory).toBe(true);
```

#### `mkdirTestPath(basePath: string, segments: string[], options?: Deno.MkdirOptions): Promise<void>`

```typescript
await mkdirTestPath(tempDir, [".github", "workflows"], { recursive: true });
```

### E2E Testing

#### `loadE2EConfig(): Promise<Record<string, string> | null>`

Loads E2E configuration from `.env.e2e` file. Returns `null` if the file doesn't
exist (allowing tests to be skipped gracefully).

```typescript
const envVars = await loadE2EConfig();
if (!envVars) {
  console.log("⊘ No .env.e2e file found, skipping E2E tests");
  return;
}

// Use envVars["PDS_URL"], envVars["IDENTIFIER"], etc.
```

#### `runCommand(command: string, args: string[], options?): Promise<{success, stdout, stderr}>`

Runs a command and captures output.

```typescript
const result = await runCommand("deno", ["run", "main.ts"], {
  cwd: tempDir,
  env: { VAR: "value" },
});

expect(result.success).toBe(true);
expect(result.stdout).toContain("Success");
```

#### `wait(ms: number): Promise<void>`

Helper for waiting in E2E tests (e.g., for PDS record propagation).

```typescript
await createRecord(client, config, record);
await wait(1000); // Wait 1 second for propagation
const retrieved = await getRecord(client, identifier, collection, rkey);
```

## Usage Patterns

### Pattern 1: Basic Unit Test

```typescript
import { cleanupTestDir, createTestDir, joinPath } from "./test_utils.ts";

Deno.test("should do something", async () => {
  const tempDir = await createTestDir("my_test_");

  try {
    const filePath = joinPath(tempDir, "test.txt");
    await Deno.writeTextFile(filePath, "content");
    // ... test assertions ...
  } finally {
    await cleanupTestDir(tempDir);
  }
});
```

### Pattern 2: Nested Directory Structure

```typescript
import {
  cleanupTestDir,
  createTestDir,
  readTestFile,
  statTestPath,
  writeTestFile,
} from "./test_utils.ts";

Deno.test("should create nested files", async () => {
  const tempDir = await createTestDir("test_");

  try {
    // Write to nested path
    await writeTestFile(
      tempDir,
      [".github", "workflows", "test.yaml"],
      "content"
    );

    // Read from nested path
    const content = await readTestFile(tempDir, [
      ".github",
      "workflows",
      "test.yaml",
    ]);

    // Check nested directory
    const stats = await statTestPath(tempDir, [".github", "workflows"]);
    expect(stats.isDirectory).toBe(true);
  } finally {
    await cleanupTestDir(tempDir);
  }
});
```

### Pattern 3: CLI Testing

```typescript
import { cleanupTestDir, createTestDir, runCommand } from "./test_utils.ts";

Deno.test("should run CLI successfully", async () => {
  const tempDir = await createTestDir("cli_test_");

  try {
    const result = await runCommand("deno", ["run", "main.ts", "init"], {
      cwd: tempDir,
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toContain("Success");
  } finally {
    await cleanupTestDir(tempDir);
  }
});
```

## When to Extract Test Logic

The test utilities module follows these principles:

### ✅ Good Candidates for Extraction

1. **Cross-platform concerns** - Path handling, file operations
2. **Repeated patterns** - Temp directory creation/cleanup
3. **Complex setup/teardown** - E2E config loading, client setup
4. **Error-prone operations** - Command execution with output capture

### ❌ Keep in Tests

1. **Test-specific assertions** - Each test's unique expectations
2. **Domain logic** - Business rules being tested
3. **Single-use helpers** - Only used in one test file
4. **Simple operations** - Basic variable assignments, simple transformations

### The Rule of Three

Extract to utilities when:

- The same code appears in **3 or more places**
- The code is **cross-platform sensitive**
- The code is **complex or error-prone**

## Benefits

### 1. Cross-Platform Compatibility

Tests work on Windows, macOS, and Linux without modification.

### 2. DRY (Don't Repeat Yourself)

Common patterns are centralized, reducing code duplication.

### 3. Consistency

All tests use the same path handling approach, preventing subtle bugs.

### 4. Maintainability

Changes to test infrastructure only need to be made in one place.

### 5. Clarity

Test code focuses on "what to test" rather than "how to set up tests".

## Migration Guide

If you have existing tests with hardcoded paths, here's how to migrate:

### Before

```typescript
const workflowPath = `${tempDir}/.github/workflows/putrecord.yaml`;
await Deno.writeTextFile(workflowPath, content);
const readContent = await Deno.readTextFile(workflowPath);
```

### After

```typescript
await writeTestFile(
  tempDir,
  [".github", "workflows", "putrecord.yaml"],
  content
);
const readContent = await readTestFile(tempDir, [
  ".github",
  "workflows",
  "putrecord.yaml",
]);
```

Or if you need the path itself:

```typescript
const workflowPath = joinPath(
  tempDir,
  ".github",
  "workflows",
  "putrecord.yaml"
);
await Deno.writeTextFile(workflowPath, content);
```

## Testing the Test Utilities

The test utilities themselves are designed to be simple and rely on Deno's
standard library, which is well-tested. However, they can be validated through:

1. **Integration with actual tests** - Used by init tests, which cover all path
   utilities
2. **Cross-platform CI** - Running tests on multiple OS platforms
3. **Manual testing** - Running tests locally on different operating systems

## Future Enhancements

Potential additions to test utilities:

- **Fixture management** - Loading test data files
- **Snapshot testing** - Comparing output to expected files
- **Parallel test isolation** - Ensuring tests don't interfere with each other
- **Mock builders** - Creating test data objects
- **Assertion helpers** - Common assertion patterns

Add new utilities when you notice the same pattern appearing in multiple tests!
