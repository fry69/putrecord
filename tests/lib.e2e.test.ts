/**
 * End-to-end integration tests for lib.ts
 * These tests run against a real PDS using credentials from .env.e2e
 * They only run if .env.e2e exists
 */

import { expect } from "@std/expect";
import {
  buildRecord,
  createRecord,
  loadConfig,
  readFile,
  uploadRecord,
} from "../src/lib.ts";
import {
  cleanupTestDir,
  createTestDir,
  deleteE2ERecord,
  getE2ERecord,
  joinPath,
  loadE2EConfig,
  setupE2EClient,
  wait,
} from "./test_utils.ts";

// Skip all E2E tests if .env.e2e doesn't exist
const envVars = await loadE2EConfig();

if (envVars) {
  console.log("✓ E2E configuration found, running integration tests...\n");

  Deno.test("E2E: Create new record without RKEY", async () => {
    const { client, identifier } = await setupE2EClient(envVars);
    const tempDir = await createTestDir("putrecord_e2e_");

    try {
      // Create test file in temp directory
      const testFile = joinPath(tempDir, "test-create.md");
      const testContent =
        `# E2E Test - Create Mode\n\nTimestamp: ${Date.now()}`;
      await Deno.writeTextFile(testFile, testContent);

      // Setup config for create mode (no RKEY)
      Deno.env.set("PDS_URL", envVars["PDS_URL"]);
      Deno.env.set("IDENTIFIER", envVars["IDENTIFIER"]);
      Deno.env.set("APP_PASSWORD", envVars["APP_PASSWORD"]);
      Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
      Deno.env.set("FILE_PATH", testFile);
      Deno.env.delete("RKEY"); // Ensure RKEY is not set

      const config = loadConfig();
      const content = await readFile(testFile);
      const record = buildRecord(config.collection, content);

      // Create new record
      const result = await createRecord(client, config, record);

      expect(result.uri).toBeTruthy();
      expect(result.cid).toBeTruthy();
      expect(result.rkey).toBeTruthy();
      expect(result.uri).toContain(result.rkey);

      console.log(`  Created record with RKEY: ${result.rkey}`);

      // Wait a bit for the record to be available
      await wait(1000);

      // Verify record exists by retrieving it
      const retrieved = await getE2ERecord(
        client,
        identifier,
        config.collection,
        result.rkey,
      );
      expect(retrieved.value).toBeTruthy();
      expect((retrieved.value as { content: string }).content).toBe(
        testContent,
      );

      // Cleanup: Delete the created record
      await deleteE2ERecord(client, identifier, config.collection, result.rkey);
      console.log(`  Cleaned up record: ${result.rkey}`);
    } finally {
      // Cleanup temp directory and all files
      await cleanupTestDir(tempDir);
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
    }
  });

  Deno.test("E2E: Update existing record with RKEY", async () => {
    const { client, identifier } = await setupE2EClient(envVars);
    const tempDir = await createTestDir("putrecord_e2e_");

    let createdRkey = "";

    try {
      // Create test file in temp directory
      const testFile = joinPath(tempDir, "test-update.md");
      const initialContent =
        `# E2E Test - Update Mode\n\nInitial: ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

      // Setup config
      Deno.env.set("PDS_URL", envVars["PDS_URL"]);
      Deno.env.set("IDENTIFIER", envVars["IDENTIFIER"]);
      Deno.env.set("APP_PASSWORD", envVars["APP_PASSWORD"]);
      Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
      Deno.env.set("FILE_PATH", testFile);
      Deno.env.delete("RKEY");

      const config = loadConfig();

      // First, create a record to update
      const initialRecord = buildRecord(config.collection, initialContent);
      const createResult = await createRecord(client, config, initialRecord);
      createdRkey = createResult.rkey;

      console.log(`  Created record for update test: ${createdRkey}`);

      // Wait for record to be available
      await wait(1000);

      // Now update the record
      const updatedContent =
        `# E2E Test - Update Mode\n\nUpdated: ${Date.now()}`;
      await Deno.writeTextFile(testFile, updatedContent);

      // Set RKEY for update mode
      Deno.env.set("RKEY", createdRkey);
      const updateConfig = loadConfig();

      const updatedRecord = buildRecord(
        updateConfig.collection,
        updatedContent,
      );
      const updateResult = await uploadRecord(
        client,
        updateConfig,
        updatedRecord,
      );

      expect(updateResult.uri).toBeTruthy();
      expect(updateResult.cid).toBeTruthy();
      expect(updateResult.uri).toContain(createdRkey);

      // Wait for update to propagate
      await wait(1000);

      // Verify the record was updated
      const retrieved = await getE2ERecord(
        client,
        identifier,
        config.collection,
        createdRkey,
      );
      expect((retrieved.value as { content: string }).content).toBe(
        updatedContent,
      );

      console.log(`  Successfully updated record: ${createdRkey}`);

      // Cleanup
      await deleteE2ERecord(client, identifier, config.collection, createdRkey);
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      // Cleanup temp directory and all files
      await cleanupTestDir(tempDir);
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
      Deno.env.delete("RKEY");
    }
  });

  Deno.test("E2E: uploadRecord should fail without RKEY", async () => {
    const { client } = await setupE2EClient(envVars);
    const tempDir = await createTestDir("putrecord_e2e_");

    try {
      const testFile = joinPath(tempDir, "test-fail.md");
      const testContent = "# Test Content";
      await Deno.writeTextFile(testFile, testContent);

      Deno.env.set("PDS_URL", envVars["PDS_URL"]);
      Deno.env.set("IDENTIFIER", envVars["IDENTIFIER"]);
      Deno.env.set("APP_PASSWORD", envVars["APP_PASSWORD"]);
      Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
      Deno.env.set("FILE_PATH", testFile);
      Deno.env.delete("RKEY");

      const config = loadConfig();
      const record = buildRecord(config.collection, testContent);

      // Should throw error when trying to update without RKEY
      await expect(uploadRecord(client, config, record)).rejects.toThrow(
        "RKEY is required for updating records",
      );
    } finally {
      await cleanupTestDir(tempDir);
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
    }
  });

  Deno.test("E2E: WhiteWind - Create with default visibility", async () => {
    const { client, identifier } = await setupE2EClient(envVars);
    const tempDir = await createTestDir("putrecord_e2e_");

    try {
      const testFile = joinPath(tempDir, "whitewind-create.md");
      const testContent =
        `# WhiteWind Test Post\n\nCreated at: ${Date.now()}\n\nThis is a test post.`;
      await Deno.writeTextFile(testFile, testContent);

      Deno.env.set("PDS_URL", envVars["PDS_URL"]);
      Deno.env.set("IDENTIFIER", envVars["IDENTIFIER"]);
      Deno.env.set("APP_PASSWORD", envVars["APP_PASSWORD"]);
      Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
      Deno.env.set("FILE_PATH", testFile);
      Deno.env.delete("RKEY");

      const config = loadConfig();
      const content = await readFile(testFile);
      const record = buildRecord(config.collection, content);

      // Verify default WhiteWind fields
      expect(record.visibility).toBe("public");
      expect(record.title).toBe("WhiteWind Test Post");

      // Create record
      const result = await createRecord(client, config, record);
      expect(result.uri).toBeTruthy();
      expect(result.rkey).toBeTruthy();

      console.log(
        `  Created WhiteWind record with default visibility: ${result.rkey}`,
      );

      // Wait for propagation
      await wait(1000);

      // Verify the record
      const retrieved = await getE2ERecord(
        client,
        identifier,
        config.collection,
        result.rkey,
      );
      expect((retrieved.value as { visibility: string }).visibility).toBe(
        "public",
      );
      expect((retrieved.value as { title: string }).title).toBe(
        "WhiteWind Test Post",
      );

      // Cleanup
      await deleteE2ERecord(client, identifier, config.collection, result.rkey);
      console.log(`  Cleaned up record: ${result.rkey}`);
    } finally {
      await cleanupTestDir(tempDir);
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
    }
  });

  Deno.test("E2E: WhiteWind - Preserve custom title on update", async () => {
    const { client, identifier } = await setupE2EClient(envVars);
    const tempDir = await createTestDir("putrecord_e2e_");
    let createdRkey = "";

    try {
      const testFile = joinPath(tempDir, "whitewind-preserve-title.md");
      const initialContent =
        `# Initial Title\n\nInitial content: ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

      Deno.env.set("PDS_URL", envVars["PDS_URL"]);
      Deno.env.set("IDENTIFIER", envVars["IDENTIFIER"]);
      Deno.env.set("APP_PASSWORD", envVars["APP_PASSWORD"]);
      Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
      Deno.env.set("FILE_PATH", testFile);
      Deno.env.delete("RKEY");

      const config = loadConfig();

      // Create initial record with custom title
      const initialRecord = buildRecord(config.collection, initialContent);
      // Manually set a custom title different from the extracted one
      initialRecord.title = "My Custom Title";
      const createResult = await createRecord(client, config, initialRecord);
      createdRkey = createResult.rkey;

      console.log(
        `  Created WhiteWind record with custom title: ${createdRkey}`,
      );
      await wait(1000);

      // Verify custom title was saved
      const beforeUpdate = await getE2ERecord(
        client,
        identifier,
        config.collection,
        createdRkey,
      );
      expect((beforeUpdate.value as { title: string }).title).toBe(
        "My Custom Title",
      );

      // Update with different content (new heading)
      const updatedContent =
        `# Different Heading\n\nUpdated content: ${Date.now()}`;
      await Deno.writeTextFile(testFile, updatedContent);

      Deno.env.set("RKEY", createdRkey);
      const updateConfig = loadConfig();

      // Fetch existing record to simulate real usage
      const existingRecord = await (async () => {
        if (!updateConfig.rkey) return undefined;
        try {
          const response = await getE2ERecord(
            client,
            identifier,
            updateConfig.collection,
            updateConfig.rkey,
          );
          return response.value as Record<string, unknown>;
        } catch {
          return undefined;
        }
      })();

      // Build updated record WITH existing record (should preserve title)
      const updatedRecord = buildRecord(
        updateConfig.collection,
        updatedContent,
        existingRecord,
        false, // Don't force fields
      );

      expect(updatedRecord.title).toBe("My Custom Title"); // Preserved!

      const updateResult = await uploadRecord(
        client,
        updateConfig,
        updatedRecord,
      );
      expect(updateResult.uri).toContain(createdRkey);

      console.log(`  Updated record while preserving custom title`);
      await wait(1000);

      // Verify title was preserved
      const afterUpdate = await getE2ERecord(
        client,
        identifier,
        config.collection,
        createdRkey,
      );
      expect((afterUpdate.value as { title: string }).title).toBe(
        "My Custom Title",
      );
      expect((afterUpdate.value as { content: string }).content).toBe(
        updatedContent,
      );

      console.log(`  ✓ Custom title preserved after update`);

      // Cleanup
      await deleteE2ERecord(client, identifier, config.collection, createdRkey);
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await cleanupTestDir(tempDir);
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
      Deno.env.delete("RKEY");
    }
  });

  Deno.test("E2E: WhiteWind - Preserve custom visibility on update", async () => {
    const { client, identifier } = await setupE2EClient(envVars);
    const tempDir = await createTestDir("putrecord_e2e_");
    let createdRkey = "";

    try {
      const testFile = joinPath(tempDir, "whitewind-preserve-visibility.md");
      const initialContent =
        `# Visibility Test\n\nInitial content: ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

      Deno.env.set("PDS_URL", envVars["PDS_URL"]);
      Deno.env.set("IDENTIFIER", envVars["IDENTIFIER"]);
      Deno.env.set("APP_PASSWORD", envVars["APP_PASSWORD"]);
      Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
      Deno.env.set("FILE_PATH", testFile);
      Deno.env.delete("RKEY");

      const config = loadConfig();

      // Create initial record with custom visibility
      const initialRecord = buildRecord(config.collection, initialContent);
      initialRecord.visibility = "author"; // Set to author-only
      const createResult = await createRecord(client, config, initialRecord);
      createdRkey = createResult.rkey;

      console.log(
        `  Created WhiteWind record with visibility="author": ${createdRkey}`,
      );
      await wait(1000);

      // Verify custom visibility was saved
      const beforeUpdate = await getE2ERecord(
        client,
        identifier,
        config.collection,
        createdRkey,
      );
      expect((beforeUpdate.value as { visibility: string }).visibility).toBe(
        "author",
      );

      // Update with new content
      const updatedContent =
        `# Visibility Test\n\nUpdated content: ${Date.now()}`;
      await Deno.writeTextFile(testFile, updatedContent);

      Deno.env.set("RKEY", createdRkey);
      const updateConfig = loadConfig();

      // Fetch existing record
      const existingRecord = await (async () => {
        if (!updateConfig.rkey) return undefined;
        try {
          const response = await getE2ERecord(
            client,
            identifier,
            updateConfig.collection,
            updateConfig.rkey,
          );
          return response.value as Record<string, unknown>;
        } catch {
          return undefined;
        }
      })();

      // Build updated record WITH existing record (should preserve visibility)
      const updatedRecord = buildRecord(
        updateConfig.collection,
        updatedContent,
        existingRecord,
        false, // Don't force fields
      );

      expect(updatedRecord.visibility).toBe("author"); // Preserved!

      const updateResult = await uploadRecord(
        client,
        updateConfig,
        updatedRecord,
      );
      expect(updateResult.uri).toContain(createdRkey);

      console.log(`  Updated record while preserving custom visibility`);
      await wait(1000);

      // Verify visibility was preserved
      const afterUpdate = await getE2ERecord(
        client,
        identifier,
        config.collection,
        createdRkey,
      );
      expect((afterUpdate.value as { visibility: string }).visibility).toBe(
        "author",
      );

      console.log(`  ✓ Custom visibility preserved after update`);

      // Cleanup
      await deleteE2ERecord(client, identifier, config.collection, createdRkey);
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await cleanupTestDir(tempDir);
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
      Deno.env.delete("RKEY");
    }
  });

  Deno.test("E2E: WhiteWind - Force fields override on update", async () => {
    const { client, identifier } = await setupE2EClient(envVars);
    const tempDir = await createTestDir("putrecord_e2e_");
    let createdRkey = "";

    try {
      const testFile = joinPath(tempDir, "whitewind-force-fields.md");
      const initialContent =
        `# Original Title\n\nInitial content: ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

      Deno.env.set("PDS_URL", envVars["PDS_URL"]);
      Deno.env.set("IDENTIFIER", envVars["IDENTIFIER"]);
      Deno.env.set("APP_PASSWORD", envVars["APP_PASSWORD"]);
      Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
      Deno.env.set("FILE_PATH", testFile);
      Deno.env.delete("RKEY");

      const config = loadConfig();

      // Create initial record with custom title and visibility
      const initialRecord = buildRecord(config.collection, initialContent);
      initialRecord.title = "Custom Title";
      initialRecord.visibility = "author";
      const createResult = await createRecord(client, config, initialRecord);
      createdRkey = createResult.rkey;

      console.log(
        `  Created WhiteWind record with custom fields: ${createdRkey}`,
      );
      await wait(1000);

      // Update with new content and FORCE fields
      const updatedContent = `# New Title\n\nUpdated content: ${Date.now()}`;
      await Deno.writeTextFile(testFile, updatedContent);

      Deno.env.set("RKEY", createdRkey);
      const updateConfig = loadConfig();

      // Fetch existing record
      const existingRecord = await (async () => {
        if (!updateConfig.rkey) return undefined;
        try {
          const response = await getE2ERecord(
            client,
            identifier,
            updateConfig.collection,
            updateConfig.rkey,
          );
          return response.value as Record<string, unknown>;
        } catch {
          return undefined;
        }
      })();

      // Build updated record WITH forceFields=true (should extract new values)
      const updatedRecord = buildRecord(
        updateConfig.collection,
        updatedContent,
        existingRecord,
        true, // Force fields!
      );

      expect(updatedRecord.title).toBe("New Title"); // Extracted from content!
      expect(updatedRecord.visibility).toBe("public"); // Reset to default!

      const updateResult = await uploadRecord(
        client,
        updateConfig,
        updatedRecord,
      );
      expect(updateResult.uri).toContain(createdRkey);

      console.log(`  Updated record with forceFields=true`);
      await wait(1000);

      // Verify fields were forced to new values
      const afterUpdate = await getE2ERecord(
        client,
        identifier,
        config.collection,
        createdRkey,
      );
      expect((afterUpdate.value as { title: string }).title).toBe("New Title");
      expect((afterUpdate.value as { visibility: string }).visibility).toBe(
        "public",
      );

      console.log(
        `  ✓ Fields forced to new extracted/default values with forceFields=true`,
      );

      // Cleanup
      await deleteE2ERecord(client, identifier, config.collection, createdRkey);
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await cleanupTestDir(tempDir);
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
      Deno.env.delete("RKEY");
    }
  });
} else {
  console.log("⊘ No .env.e2e file found, skipping E2E tests\n");
}
