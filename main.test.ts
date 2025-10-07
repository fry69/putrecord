/**
 * Unit tests for main.ts functions
 */

import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { createBlogRecord, loadConfig, readMarkdown } from "./main.ts";

Deno.test("loadConfig - should load all required environment variables", () => {
  // Set up environment
  Deno.env.set("PDS_URL", "https://test.pds");
  Deno.env.set("IDENTIFIER", "test.handle");
  Deno.env.set("APP_PASSWORD", "test-pass");
  Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
  Deno.env.set("RKEY", "test-rkey");
  Deno.env.set("MARKDOWN_PATH", "./test.md");

  const config = loadConfig();

  assertEquals(config.pdsUrl, "https://test.pds");
  assertEquals(config.identifier, "test.handle");
  assertEquals(config.password, "test-pass");
  assertEquals(config.collection, "com.whtwnd.blog.entry");
  assertEquals(config.rkey, "test-rkey");
  assertEquals(config.markdownPath, "./test.md");

  // Cleanup
  Deno.env.delete("PDS_URL");
  Deno.env.delete("IDENTIFIER");
  Deno.env.delete("APP_PASSWORD");
  Deno.env.delete("COLLECTION");
  Deno.env.delete("RKEY");
  Deno.env.delete("MARKDOWN_PATH");
});

Deno.test("loadConfig - should throw if required variable is missing", () => {
  // Clear all vars
  Deno.env.delete("PDS_URL");
  Deno.env.delete("IDENTIFIER");
  Deno.env.delete("APP_PASSWORD");
  Deno.env.delete("COLLECTION");
  Deno.env.delete("RKEY");
  Deno.env.delete("MARKDOWN_PATH");

  let error: Error | undefined;
  try {
    loadConfig();
  } catch (e) {
    error = e as Error;
  }

  assertEquals(error !== undefined, true);
  assertStringIncludes(error!.message, "Missing required environment variable");
});

Deno.test("createBlogRecord - should create valid WhiteWind blog entry", () => {
  const content = "# Test Blog Post\n\nThis is a test.";
  const record = createBlogRecord(content);

  assertEquals(record.$type, "com.whtwnd.blog.entry");
  assertEquals(record.content, content);
  assertEquals(typeof record.createdAt, "string");

  // Validate ISO timestamp
  const timestamp = new Date(record.createdAt as string);
  assertEquals(timestamp instanceof Date && !isNaN(timestamp.getTime()), true);
});

Deno.test("readMarkdown - should read markdown file successfully", async () => {
  const testFile = "./test-temp.md";
  const testContent = "# Test Content";

  // Create test file
  await Deno.writeTextFile(testFile, testContent);

  try {
    const content = await readMarkdown(testFile);
    assertEquals(content, testContent);
  } finally {
    // Cleanup
    await Deno.remove(testFile);
  }
});

Deno.test("readMarkdown - should throw error for non-existent file", async () => {
  await assertRejects(
    async () => {
      await readMarkdown("./non-existent-file.md");
    },
    Error,
    "Failed to read file",
  );
});
