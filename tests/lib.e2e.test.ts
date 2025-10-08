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
import { Client, CredentialManager, ok } from "@atcute/client";
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

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim();
          Deno.env.set(key.trim(), value);
        }
      }
    }

    // Verify required credentials are present
    const required = ["PDS_URL", "IDENTIFIER", "APP_PASSWORD"];
    for (const key of required) {
      if (!Deno.env.get(key)) {
        throw new Error(`Missing ${key} in .env.e2e`);
      }
    }

    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

/**
 * Setup authenticated client for E2E tests
 */
async function setupClient() {
  const pdsUrl = Deno.env.get("PDS_URL")!;
  const identifier = Deno.env.get("IDENTIFIER")!;
  const password = Deno.env.get("APP_PASSWORD")!;

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
 * Retrieve a record from PDS to verify it exists
 */
async function getRecord(
  client: Client,
  identifier: string,
  collection: string,
  rkey: string,
) {
  const response = await ok(
    client.get("com.atproto.repo.getRecord", {
      params: {
        repo: identifier as ActorIdentifier,
        collection: collection as Nsid,
        rkey,
      },
    }),
  );
  return response;
}

// Skip all E2E tests if .env.e2e doesn't exist
const hasE2EConfig = await loadE2EConfig();

if (hasE2EConfig) {
  console.log("✓ E2E configuration found, running integration tests...\n");

  Deno.test("E2E: Create new record without RKEY", async () => {
    const { client, identifier } = await setupClient();
    const tempDir = await Deno.makeTempDir({ prefix: "putrecord_e2e_" });

    try {
      // Create test file in temp directory
      const testFile = `${tempDir}/test-create.md`;
      const testContent =
        `# E2E Test - Create Mode\n\nTimestamp: ${Date.now()}`;
      await Deno.writeTextFile(testFile, testContent);

      // Setup config for create mode (no RKEY)
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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify record exists by retrieving it
      const retrieved = await getRecord(
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
      await deleteRecord(client, identifier, config.collection, result.rkey);
      console.log(`  Cleaned up record: ${result.rkey}`);
    } finally {
      // Cleanup temp directory and all files
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
    }
  });

  Deno.test("E2E: Update existing record with RKEY", async () => {
    const { client, identifier } = await setupClient();
    const tempDir = await Deno.makeTempDir({ prefix: "putrecord_e2e_" });

    let createdRkey = "";

    try {
      // Create test file in temp directory
      const testFile = `${tempDir}/test-update.md`;
      const initialContent =
        `# E2E Test - Update Mode\n\nInitial: ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

      // Setup config
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
      await new Promise((resolve) => setTimeout(resolve, 1000));

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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify the record was updated
      const retrieved = await getRecord(
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
      await deleteRecord(client, identifier, config.collection, createdRkey);
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      // Cleanup temp directory and all files
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
      Deno.env.delete("RKEY");
    }
  });

  Deno.test("E2E: uploadRecord should fail without RKEY", async () => {
    const { client } = await setupClient();
    const tempDir = await Deno.makeTempDir({ prefix: "putrecord_e2e_" });

    try {
      const testFile = `${tempDir}/test-fail.md`;
      const testContent = "# Test Content";
      await Deno.writeTextFile(testFile, testContent);

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
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
    }
  });

  Deno.test("E2E: WhiteWind - Create with default visibility", async () => {
    const { client, identifier } = await setupClient();
    const tempDir = await Deno.makeTempDir({ prefix: "putrecord_e2e_" });

    try {
      const testFile = `${tempDir}/whitewind-create.md`;
      const testContent =
        `# WhiteWind Test Post\n\nCreated at: ${Date.now()}\n\nThis is a test post.`;
      await Deno.writeTextFile(testFile, testContent);

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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify the record
      const retrieved = await getRecord(
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
      await deleteRecord(client, identifier, config.collection, result.rkey);
      console.log(`  Cleaned up record: ${result.rkey}`);
    } finally {
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
    }
  });

  Deno.test("E2E: WhiteWind - Preserve custom title on update", async () => {
    const { client, identifier } = await setupClient();
    const tempDir = await Deno.makeTempDir({ prefix: "putrecord_e2e_" });
    let createdRkey = "";

    try {
      const testFile = `${tempDir}/whitewind-preserve-title.md`;
      const initialContent =
        `# Initial Title\n\nInitial content: ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify custom title was saved
      const beforeUpdate = await getRecord(
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
          const response = await getRecord(
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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify title was preserved
      const afterUpdate = await getRecord(
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
      await deleteRecord(client, identifier, config.collection, createdRkey);
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
      Deno.env.delete("RKEY");
    }
  });

  Deno.test("E2E: WhiteWind - Preserve custom visibility on update", async () => {
    const { client, identifier } = await setupClient();
    const tempDir = await Deno.makeTempDir({ prefix: "putrecord_e2e_" });
    let createdRkey = "";

    try {
      const testFile = `${tempDir}/whitewind-preserve-visibility.md`;
      const initialContent =
        `# Visibility Test\n\nInitial content: ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify custom visibility was saved
      const beforeUpdate = await getRecord(
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
          const response = await getRecord(
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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify visibility was preserved
      const afterUpdate = await getRecord(
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
      await deleteRecord(client, identifier, config.collection, createdRkey);
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
      Deno.env.delete("RKEY");
    }
  });

  Deno.test("E2E: WhiteWind - Force fields override on update", async () => {
    const { client, identifier } = await setupClient();
    const tempDir = await Deno.makeTempDir({ prefix: "putrecord_e2e_" });
    let createdRkey = "";

    try {
      const testFile = `${tempDir}/whitewind-force-fields.md`;
      const initialContent =
        `# Original Title\n\nInitial content: ${Date.now()}`;
      await Deno.writeTextFile(testFile, initialContent);

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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update with new content and FORCE fields
      const updatedContent = `# New Title\n\nUpdated content: ${Date.now()}`;
      await Deno.writeTextFile(testFile, updatedContent);

      Deno.env.set("RKEY", createdRkey);
      const updateConfig = loadConfig();

      // Fetch existing record
      const existingRecord = await (async () => {
        if (!updateConfig.rkey) return undefined;
        try {
          const response = await getRecord(
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
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify fields were forced to new values
      const afterUpdate = await getRecord(
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
      await deleteRecord(client, identifier, config.collection, createdRkey);
      console.log(`  Cleaned up record: ${createdRkey}`);
    } finally {
      await Deno.remove(tempDir, { recursive: true }).catch(() => {});
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
      Deno.env.delete("RKEY");
    }
  });
} else {
  console.log("⊘ No .env.e2e file found, skipping E2E tests\n");
}
