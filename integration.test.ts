/**
 * Integration test - validates dependencies work together
 */

import { expect } from "@std/expect";
import { Client, CredentialManager } from "@atcute/client";
import { createBlogRecord, loadConfig, readMarkdown } from "./main.ts";

/**
 * Test that all components can be instantiated and work together
 * Note: This doesn't make network calls, it only validates the integration
 * of imports and basic instantiation. Real integration testing would require
 * a mock PDS or test server.
 */
Deno.test("Integration - components work together", async () => {
  // Set up test environment
  Deno.env.set("PDS_URL", "https://test.pds");
  Deno.env.set("IDENTIFIER", "test.handle");
  Deno.env.set("APP_PASSWORD", "test-pass");
  Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
  Deno.env.set("RKEY", "test-rkey");
  Deno.env.set("MARKDOWN_PATH", "./test-integration.md");

  const testContent = "# Test\n\nContent here.";
  await Deno.writeTextFile("./test-integration.md", testContent);

  try {
    // Test 1: Config loading works
    const config = loadConfig();
    expect(config.pdsUrl).toBe("https://test.pds");

    // Test 2: File reading works
    const content = await readMarkdown(config.markdownPath);
    expect(content).toBe(testContent);

    // Test 3: Record creation works
    const record = createBlogRecord(content);
    expect(record.$type).toBe("com.whtwnd.blog.entry");
    expect(record.content).toBe(testContent);

    // Test 4: atcute client can be instantiated
    const manager = new CredentialManager({ service: config.pdsUrl });
    const client = new Client({ handler: manager });
    expect(client.post).toBeDefined();
  } finally {
    // Cleanup
    await Deno.remove("./test-integration.md");
    Deno.env.delete("PDS_URL");
    Deno.env.delete("IDENTIFIER");
    Deno.env.delete("APP_PASSWORD");
    Deno.env.delete("COLLECTION");
    Deno.env.delete("RKEY");
    Deno.env.delete("MARKDOWN_PATH");
  }
});
