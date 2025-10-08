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

    // Create test file
    const testFile = "./test-e2e-create.md";
    const testContent = `# E2E Test - Create Mode\n\nTimestamp: ${Date.now()}`;
    await Deno.writeTextFile(testFile, testContent);

    try {
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
      // Cleanup test file
      await Deno.remove(testFile).catch(() => {});
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
    }
  });

  Deno.test("E2E: Update existing record with RKEY", async () => {
    const { client, identifier } = await setupClient();

    // Create test file
    const testFile = "./test-e2e-update.md";
    const initialContent = `# E2E Test - Update Mode\n\nInitial: ${Date.now()}`;
    await Deno.writeTextFile(testFile, initialContent);

    let createdRkey = "";

    try {
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
      // Cleanup test file
      await Deno.remove(testFile).catch(() => {});
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
      Deno.env.delete("RKEY");
    }
  });

  Deno.test("E2E: uploadRecord should fail without RKEY", async () => {
    const { client } = await setupClient();

    const testFile = "./test-e2e-fail.md";
    const testContent = "# Test Content";
    await Deno.writeTextFile(testFile, testContent);

    try {
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
      await Deno.remove(testFile).catch(() => {});
      Deno.env.delete("COLLECTION");
      Deno.env.delete("FILE_PATH");
    }
  });
} else {
  console.log("⊘ No .env.e2e file found, skipping E2E tests\n");
}
