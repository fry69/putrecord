/**
 * Unit tests for main.ts functions
 */

import { expect } from "@std/expect";
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

  expect(config.pdsUrl).toBe("https://test.pds");
  expect(config.identifier).toBe("test.handle");
  expect(config.password).toBe("test-pass");
  expect(config.collection).toBe("com.whtwnd.blog.entry");
  expect(config.rkey).toBe("test-rkey");
  expect(config.markdownPath).toBe("./test.md");

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

  expect(() => loadConfig()).toThrow("Missing required environment variable");
});

Deno.test("createBlogRecord - should create valid WhiteWind blog entry", () => {
  const content = "# Test Blog Post\n\nThis is a test.";
  const record = createBlogRecord(content);

  expect(record.$type).toBe("com.whtwnd.blog.entry");
  expect(record.content).toBe(content);
  expect(typeof record.createdAt).toBe("string");

  // Validate ISO timestamp
  const timestamp = new Date(record.createdAt as string);
  expect(timestamp).toBeInstanceOf(Date);
  expect(timestamp.getTime()).not.toBeNaN();
});

Deno.test("readMarkdown - should read markdown file successfully", async () => {
  const testFile = "./test-temp.md";
  const testContent = "# Test Content";

  // Create test file
  await Deno.writeTextFile(testFile, testContent);

  try {
    const content = await readMarkdown(testFile);
    expect(content).toBe(testContent);
  } finally {
    // Cleanup
    await Deno.remove(testFile);
  }
});

Deno.test("readMarkdown - should throw error for non-existent file", async () => {
  await expect(readMarkdown("./non-existent-file.md")).rejects.toThrow(
    "Failed to read file",
  );
});
