/**
 * End-to-end CLI tests for main.ts
 * These tests run the actual CLI command against a real PDS using credentials from .env.e2e
 * They only run if .env.e2e exists
 */

import { expect } from "@std/expect";
import {
  cleanupTestDir,
  createTestDir,
  deleteE2ERecord,
  getE2ERecord,
  joinPath,
  loadE2EConfig,
  runCLI,
  setupE2EClient,
  updateE2ERecord,
  wait,
} from "./test_utils.ts";

// Skip all E2E tests if .env.e2e doesn't exist
const envVars = await loadE2EConfig();

if (envVars) {
  console.log("✓ E2E configuration found, running CLI integration tests...\n");

  Deno.test("CLI E2E: WhiteWind - Create and preserve custom title on update", async () => {
    const { client, identifier } = await setupE2EClient(envVars);
    const tempDir = await createTestDir("putrecord_cli_e2e_");

    let createdRkey = "";

    try {
      // Create test file
      const testFile = joinPath(tempDir, "blog-post.md");
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
      await wait(1000);

      // Manually update the title to a custom value
      const beforeUpdate = await getE2ERecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      const customTitle = "My Custom Blog Title";

      // Update record with custom title via API
      await updateE2ERecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
        {
          ...beforeUpdate.value,
          title: customTitle,
        },
      );

      console.log(`  Set custom title via API: "${customTitle}"`);
      await wait(1000);

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
      await wait(1000);

      // Verify custom title was preserved
      const afterUpdate = await getE2ERecord(
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
      await deleteE2ERecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await cleanupTestDir(tempDir);
    }
  });

  Deno.test("CLI E2E: WhiteWind - Force fields override with --force-fields", async () => {
    const { client, identifier } = await setupE2EClient(envVars);
    const tempDir = await createTestDir("putrecord_cli_e2e_");

    let createdRkey = "";

    try {
      // Create test file
      const testFile = joinPath(tempDir, "blog-post-force.md");
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
      await wait(1000);

      // Set custom title and visibility
      const beforeUpdate = await getE2ERecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      const customTitle = "Custom Title Override";

      await updateE2ERecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
        {
          ...beforeUpdate.value,
          title: customTitle,
          visibility: "author",
        },
      );

      console.log(
        `  Set custom title="${customTitle}" and visibility="author" via API`,
      );
      await wait(1000);

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
      await wait(1000);

      // Verify fields were forced to new values
      const afterUpdate = await getE2ERecord(
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
      await deleteE2ERecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await cleanupTestDir(tempDir);
    }
  });

  Deno.test("CLI E2E: WhiteWind - Force fields via FORCE_FIELDS env var", async () => {
    const { client, identifier } = await setupE2EClient(envVars);
    const tempDir = await createTestDir("putrecord_cli_e2e_");

    let createdRkey = "";

    try {
      // Create test file
      const testFile = joinPath(tempDir, "blog-post-env.md");
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
      await wait(1000);

      // Set custom title
      const beforeUpdate = await getE2ERecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      const customTitle = "Custom via Env Var";

      await updateE2ERecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
        {
          ...beforeUpdate.value,
          title: customTitle,
        },
      );

      console.log(`  Set custom title="${customTitle}" via API`);
      await wait(1000);

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
      await wait(1000);

      // Verify title was forced to new value
      const afterUpdate = await getE2ERecord(
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
      await deleteE2ERecord(
        client,
        identifier,
        "com.whtwnd.blog.entry",
        createdRkey,
      );
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await cleanupTestDir(tempDir);
    }
  });
} else {
  console.log("⊘ No .env.e2e file found, skipping CLI E2E tests\n");
}
