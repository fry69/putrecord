/**
 * End-to-end CLI tests for main.ts
 * These tests run the actual CLI command against a real PDS using credentials from .env.e2e
 * They only run if .env.e2e exists
 */

import { expect } from "@std/expect";
import { Client, CredentialManager, ok } from "@atcute/client";
import type {} from "@atcute/atproto"; // Import AT Protocol types
import type { ActorIdentifier, Nsid } from "@atcute/lexicons";

/**
 * Load E2E test configuration from .env.e2e
 */
async function loadE2EConfig() {
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
 * Setup authenticated client for cleanup operations
 */
async function setupClient(envVars: Record<string, string>) {
  const pdsUrl = envVars["PDS_URL"];
  const identifier = envVars["IDENTIFIER"];
  const password = envVars["APP_PASSWORD"];

  const manager = new CredentialManager({ service: pdsUrl });
  const client = new Client({ handler: manager });

  await manager.login({
    identifier,
    password,
  });

  return { client, identifier };
}

/**
 * Clean up test records from PDS
 */
async function deleteRecord(
  client: Client,
  identifier: string,
  collection: string,
  rkey: string,
) {
  try {
    await ok(
      client.post("com.atproto.repo.deleteRecord", {
        input: {
          repo: identifier as ActorIdentifier,
          collection: collection as Nsid,
          rkey,
        },
      }),
    );
  } catch (_error) {
    // Ignore errors during cleanup
  }
}

/**
 * Retrieve a record from PDS
 */
async function getRecord(
  client: Client,
  identifier: string,
  collection: string,
  rkey: string,
): Promise<{ value: Record<string, unknown> }> {
  const response = await ok(
    client.get("com.atproto.repo.getRecord", {
      params: {
        repo: identifier as ActorIdentifier,
        collection: collection as Nsid,
        rkey,
      },
    }),
  );
  return response as { value: Record<string, unknown> };
}

/**
 * Run the CLI command and capture output
 */
async function runCLI(
  args: string[],
  env?: Record<string, string>,
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const command = new Deno.Command("deno", {
    args: ["run", "--allow-all", "src/main.ts", ...args],
    env,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();

  return {
    success: code === 0,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

// Skip all E2E tests if .env.e2e doesn't exist
const envVars = await loadE2EConfig();

if (envVars) {
  console.log("✓ E2E configuration found, running CLI integration tests...\n");

  Deno.test("CLI E2E: WhiteWind - Create and preserve custom title on update", async () => {
    const { client, identifier } = await setupClient(envVars);
    const tempDir = await Deno.makeTempDir({ prefix: "putrecord_cli_e2e_" });

    let createdRkey = "";

    try {
      // Create test file
      const testFile = `${tempDir}/blog-post.md`;
      const initialContent =
        `# Initial Blog Title\n\nInitial content at ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

      // Create initial record
      const createResult = await runCLI([], {
        PDS_URL: envVars["PDS_URL"],
        IDENTIFIER: envVars["IDENTIFIER"],
        APP_PASSWORD: envVars["APP_PASSWORD"],
        COLLECTION: "com.whtwnd.blog.entry",
        FILE_PATH: testFile,
      });

      if (!createResult.success) {
        console.error("CLI stdout:", createResult.stdout);
        console.error("CLI stderr:", createResult.stderr);
      }
      expect(createResult.success).toBe(true);
      expect(createResult.stdout).toContain("created successfully");

      // Extract RKEY from output
      const rkeyMatch = createResult.stdout.match(/RKEY:\s+(\S+)/);
      expect(rkeyMatch).toBeTruthy();
      createdRkey = rkeyMatch![1];

      console.log(`  Created record via CLI: ${createdRkey}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Manually update the title to a custom value
      const beforeUpdate = await getRecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      const customTitle = "My Custom Blog Title";

      // Update record with custom title via API
      await ok(
        client.post("com.atproto.repo.putRecord", {
          input: {
            repo: identifier as ActorIdentifier,
            collection: "com.whtwnd.blog.entry" as Nsid,
            rkey: createdRkey,
            record: {
              ...beforeUpdate.value,
              title: customTitle,
            },
          },
        }),
      );

      console.log(`  Set custom title via API: "${customTitle}"`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update content with new heading (default: should preserve title)
      const updatedContent =
        `# Different Heading\n\nUpdated content at ${Date.now()}`;
      await Deno.writeTextFile(testFile, updatedContent);

      const updateResult = await runCLI([], {
        PDS_URL: envVars["PDS_URL"],
        IDENTIFIER: envVars["IDENTIFIER"],
        APP_PASSWORD: envVars["APP_PASSWORD"],
        COLLECTION: "com.whtwnd.blog.entry",
        FILE_PATH: testFile,
        RKEY: createdRkey,
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.stdout).toContain("updated successfully");

      console.log(`  Updated record via CLI (default behavior)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify custom title was preserved
      const afterUpdate = await getRecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      expect((afterUpdate.value as { title: string }).title).toBe(customTitle);
      expect((afterUpdate.value as { content: string }).content).toBe(
        updatedContent,
      );

      console.log(`  ✓ Custom title preserved: "${customTitle}"`);

      // Cleanup
      await deleteRecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  });

  Deno.test("CLI E2E: WhiteWind - Force fields override with --force-fields", async () => {
    const { client, identifier } = await setupClient(envVars);
    const tempDir = await Deno.makeTempDir({ prefix: "putrecord_cli_e2e_" });

    let createdRkey = "";

    try {
      // Create test file
      const testFile = `${tempDir}/blog-post-force.md`;
      const initialContent =
        `# Original Title\n\nInitial content at ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

      // Create initial record
      const createResult = await runCLI([], {
        PDS_URL: envVars["PDS_URL"],
        IDENTIFIER: envVars["IDENTIFIER"],
        APP_PASSWORD: envVars["APP_PASSWORD"],
        COLLECTION: "com.whtwnd.blog.entry",
        FILE_PATH: testFile,
      });

      expect(createResult.success).toBe(true);
      const rkeyMatch = createResult.stdout.match(/RKEY:\s+(\S+)/);
      createdRkey = rkeyMatch![1];

      console.log(`  Created record via CLI: ${createdRkey}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Set custom title and visibility
      const beforeUpdate = await getRecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      const customTitle = "Custom Title Override";

      await ok(
        client.post("com.atproto.repo.putRecord", {
          input: {
            repo: identifier as ActorIdentifier,
            collection: "com.whtwnd.blog.entry" as Nsid,
            rkey: createdRkey,
            record: {
              ...beforeUpdate.value,
              title: customTitle,
              visibility: "author",
            },
          },
        }),
      );

      console.log(
        `  Set custom title="${customTitle}" and visibility="author" via API`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update with --force-fields flag (should extract new title and reset visibility)
      const updatedContent =
        `# Forced New Title\n\nUpdated content at ${Date.now()}`;
      await Deno.writeTextFile(testFile, updatedContent);

      const updateResult = await runCLI(["--force-fields"], {
        PDS_URL: envVars["PDS_URL"],
        IDENTIFIER: envVars["IDENTIFIER"],
        APP_PASSWORD: envVars["APP_PASSWORD"],
        COLLECTION: "com.whtwnd.blog.entry",
        FILE_PATH: testFile,
        RKEY: createdRkey,
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.stdout).toContain("updated successfully");

      console.log(`  Updated record with --force-fields`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify fields were forced to new values
      const afterUpdate = await getRecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      expect((afterUpdate.value as { title: string }).title).toBe(
        "Forced New Title",
      );
      expect((afterUpdate.value as { visibility: string }).visibility).toBe(
        "public",
      );

      console.log(
        `  ✓ Title forced to "Forced New Title" and visibility reset to "public"`,
      );

      // Cleanup
      await deleteRecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  });

  Deno.test("CLI E2E: WhiteWind - Force fields via FORCE_FIELDS env var", async () => {
    const { client, identifier } = await setupClient(envVars);
    const tempDir = await Deno.makeTempDir({ prefix: "putrecord_cli_e2e_" });

    let createdRkey = "";

    try {
      // Create test file
      const testFile = `${tempDir}/blog-post-env.md`;
      const initialContent =
        `# Original Title\n\nInitial content at ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

      // Create initial record
      const createResult = await runCLI([], {
        PDS_URL: envVars["PDS_URL"],
        IDENTIFIER: envVars["IDENTIFIER"],
        APP_PASSWORD: envVars["APP_PASSWORD"],
        COLLECTION: "com.whtwnd.blog.entry",
        FILE_PATH: testFile,
      });

      expect(createResult.success).toBe(true);
      const rkeyMatch = createResult.stdout.match(/RKEY:\s+(\S+)/);
      createdRkey = rkeyMatch![1];

      console.log(`  Created record via CLI: ${createdRkey}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Set custom title
      const beforeUpdate = await getRecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      const customTitle = "Custom via Env Var";

      await ok(
        client.post("com.atproto.repo.putRecord", {
          input: {
            repo: identifier as ActorIdentifier,
            collection: "com.whtwnd.blog.entry" as Nsid,
            rkey: createdRkey,
            record: {
              ...beforeUpdate.value,
              title: customTitle,
            },
          },
        }),
      );

      console.log(`  Set custom title="${customTitle}" via API`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update with FORCE_FIELDS env var (should extract new title)
      const updatedContent =
        `# New Title From Env\n\nUpdated content at ${Date.now()}`;
      await Deno.writeTextFile(testFile, updatedContent);

      const updateResult = await runCLI([], {
        PDS_URL: envVars["PDS_URL"],
        IDENTIFIER: envVars["IDENTIFIER"],
        APP_PASSWORD: envVars["APP_PASSWORD"],
        COLLECTION: "com.whtwnd.blog.entry",
        FILE_PATH: testFile,
        RKEY: createdRkey,
        FORCE_FIELDS: "true", // Use env var instead of flag
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.stdout).toContain("updated successfully");

      console.log(`  Updated record with FORCE_FIELDS=true`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify title was forced to new value
      const afterUpdate = await getRecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      expect((afterUpdate.value as { title: string }).title).toBe(
        "New Title From Env",
      );

      console.log(`  ✓ Title forced to "New Title From Env" via FORCE_FIELDS`);

      // Cleanup
      await deleteRecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
    }
  });
} else {
  console.log("⊘ No .env.e2e file found, skipping CLI E2E tests\n");
}
