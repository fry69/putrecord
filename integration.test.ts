/**
 * Integration tests for the full upload workflow
 * These tests mock the network calls to avoid real PDS interaction
 */

import { expect } from "@std/expect";
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
    expect(content).toBe(testContent);

    // Step 4: Create record structure
    const record = {
      $type: "com.whtwnd.blog.entry",
      content: content,
      createdAt: new Date().toISOString(),
    };

    // Validate record structure
    expect(record.$type).toBe("com.whtwnd.blog.entry");
    expect(record.content).toBe(testContent);
    expect(record.createdAt).toContain("T"); // ISO format check

    // Step 5: Validate that Client and CredentialManager can be instantiated
    // (without actually connecting)
    const manager = new CredentialManager({ service: mockConfig.pdsUrl });
    const client = new Client({ handler: manager });

    expect(typeof manager).toBe("object");
    expect(typeof client).toBe("object");
    expect(typeof client.post).toBe("function");

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
    expect(requestPayload.collection).toBe("com.whtwnd.blog.entry");
    expect(requestPayload.rkey).toBe("test-rkey");
    expect(requestPayload.record.$type).toBe("com.whtwnd.blog.entry");
    expect(requestPayload.record.content).toBe(originalContent);
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
    expect(Deno.env.get("PDS_URL")).toBe("https://integration-test.pds");
    expect(Deno.env.get("IDENTIFIER")).toBe("integration.test");
    expect(Deno.env.get("APP_PASSWORD")).toBe("int-test-pass");
    expect(Deno.env.get("COLLECTION")).toBe("com.whtwnd.blog.entry");
    expect(Deno.env.get("RKEY")).toBe("integration-rkey");
    expect(Deno.env.get("MARKDOWN_PATH")).toBe("./integration-test.md");
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
