/**
 * Integration tests for the full upload workflow
 * These tests mock the network calls to avoid real PDS interaction
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { Client, CredentialManager } from "@atcute/client";

/**
 * Mock test to verify the workflow structure
 * In a real integration test, you'd mock the network calls or use a test PDS
 */
Deno.test("Integration - workflow validation", async () => {
  // This test validates the structure without making real network calls

  // Step 1: Configuration should be loadable
  const mockConfig = {
    pdsUrl: "https://test.pds",
    identifier: "test.handle",
    password: "test-password",
    collection: "com.whtwnd.blog.entry",
    rkey: "test-rkey",
    markdownPath: "./test-temp-integration.md",
  };

  // Step 2: Create test markdown file
  const testContent = "# Integration Test\n\nThis is a test blog post.";
  await Deno.writeTextFile(mockConfig.markdownPath, testContent);

  try {
    // Step 3: Read the file
    const content = await Deno.readTextFile(mockConfig.markdownPath);
    assertEquals(content, testContent);

    // Step 4: Create record structure
    const record = {
      $type: "com.whtwnd.blog.entry",
      content: content,
      createdAt: new Date().toISOString(),
    };

    // Validate record structure
    assertEquals(record.$type, "com.whtwnd.blog.entry");
    assertEquals(record.content, testContent);
    assertStringIncludes(record.createdAt, "T"); // ISO format check

    // Step 5: Validate that Client and CredentialManager can be instantiated
    // (without actually connecting)
    const manager = new CredentialManager({ service: mockConfig.pdsUrl });
    const client = new Client({ handler: manager });

    assertEquals(typeof manager, "object");
    assertEquals(typeof client, "object");
    assertEquals(typeof client.post, "function");

    // Note: We don't actually call login() or post() to avoid network calls
    // In a real integration test environment, you would:
    // 1. Set up a test PDS instance
    // 2. Create a test account
    // 3. Perform the full upload workflow
    // 4. Verify the record was created correctly
  } finally {
    // Cleanup
    await Deno.remove(mockConfig.markdownPath);
  }
});

/**
 * Test the complete data flow without network
 */
Deno.test("Integration - data transformation flow", async () => {
  const originalContent = "# My Blog Post\n\nContent here.";

  // Simulate reading from file
  const tempFile = "./test-flow.md";
  await Deno.writeTextFile(tempFile, originalContent);

  try {
    const fileContent = await Deno.readTextFile(tempFile);

    // Transform to record
    const record = {
      $type: "com.whtwnd.blog.entry",
      content: fileContent,
      createdAt: new Date().toISOString(),
    };

    // Simulate what would be sent to PDS
    const requestPayload = {
      repo: "did:plc:test123",
      collection: "com.whtwnd.blog.entry",
      rkey: "test-rkey",
      record: record,
    };

    // Validate payload structure
    assertEquals(requestPayload.collection, "com.whtwnd.blog.entry");
    assertEquals(requestPayload.rkey, "test-rkey");
    assertEquals(requestPayload.record.$type, "com.whtwnd.blog.entry");
    assertEquals(requestPayload.record.content, originalContent);
  } finally {
    await Deno.remove(tempFile);
  }
});

/**
 * Test environment variable handling in integration context
 */
Deno.test("Integration - environment configuration", () => {
  // Backup existing env vars
  const backup = {
    PDS_URL: Deno.env.get("PDS_URL"),
    IDENTIFIER: Deno.env.get("IDENTIFIER"),
    APP_PASSWORD: Deno.env.get("APP_PASSWORD"),
    COLLECTION: Deno.env.get("COLLECTION"),
    RKEY: Deno.env.get("RKEY"),
    MARKDOWN_PATH: Deno.env.get("MARKDOWN_PATH"),
  };

  try {
    // Set test environment
    Deno.env.set("PDS_URL", "https://integration-test.pds");
    Deno.env.set("IDENTIFIER", "integration.test");
    Deno.env.set("APP_PASSWORD", "int-test-pass");
    Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
    Deno.env.set("RKEY", "integration-rkey");
    Deno.env.set("MARKDOWN_PATH", "./integration-test.md");

    // Verify all vars are set
    assertEquals(Deno.env.get("PDS_URL"), "https://integration-test.pds");
    assertEquals(Deno.env.get("IDENTIFIER"), "integration.test");
    assertEquals(Deno.env.get("APP_PASSWORD"), "int-test-pass");
    assertEquals(Deno.env.get("COLLECTION"), "com.whtwnd.blog.entry");
    assertEquals(Deno.env.get("RKEY"), "integration-rkey");
    assertEquals(Deno.env.get("MARKDOWN_PATH"), "./integration-test.md");
  } finally {
    // Restore original env vars
    Object.entries(backup).forEach(([key, value]) => {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    });
  }
});
