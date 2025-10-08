/**
 * Unit tests for main.ts functions
 */

import { expect } from "@std/expect";
import { createBlogRecord, loadConfig, readFile } from "./main.ts";

Deno.test("loadConfig - should load all required environment variables with RKEY", () => {
  // Set up environment
  Deno.env.set("PDS_URL", "https://test.pds");
  Deno.env.set("IDENTIFIER", "test.handle");
  Deno.env.set("APP_PASSWORD", "test-pass");
  Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
  Deno.env.set("RKEY", "test-rkey");
  Deno.env.set("FILE_PATH", "./test.md");

  const config = loadConfig();

  expect(config.pdsUrl).toBe("https://test.pds");
  expect(config.identifier).toBe("test.handle");
  expect(config.password).toBe("test-pass");
  expect(config.collection).toBe("com.whtwnd.blog.entry");
  expect(config.rkey).toBe("test-rkey");
  expect(config.filePath).toBe("./test.md");

  // Cleanup
  Deno.env.delete("PDS_URL");
  Deno.env.delete("IDENTIFIER");
  Deno.env.delete("APP_PASSWORD");
  Deno.env.delete("COLLECTION");
  Deno.env.delete("RKEY");
  Deno.env.delete("FILE_PATH");
});

Deno.test("loadConfig - should work without RKEY (create mode)", () => {
  // Set up environment without RKEY
  Deno.env.set("PDS_URL", "https://test.pds");
  Deno.env.set("IDENTIFIER", "test.handle");
  Deno.env.set("APP_PASSWORD", "test-pass");
  Deno.env.set("COLLECTION", "com.whtwnd.blog.entry");
  Deno.env.set("FILE_PATH", "./test.md");

  const config = loadConfig();

  expect(config.pdsUrl).toBe("https://test.pds");
  expect(config.identifier).toBe("test.handle");
  expect(config.password).toBe("test-pass");
  expect(config.collection).toBe("com.whtwnd.blog.entry");
  expect(config.rkey).toBeUndefined();
  expect(config.filePath).toBe("./test.md");

  // Cleanup
  Deno.env.delete("PDS_URL");
  Deno.env.delete("IDENTIFIER");
  Deno.env.delete("APP_PASSWORD");
  Deno.env.delete("COLLECTION");
  Deno.env.delete("FILE_PATH");
});

Deno.test("loadConfig - should throw if required variable is missing", () => {
  // Clear all vars
  Deno.env.delete("PDS_URL");
  Deno.env.delete("IDENTIFIER");
  Deno.env.delete("APP_PASSWORD");
  Deno.env.delete("COLLECTION");
  Deno.env.delete("RKEY");
  Deno.env.delete("FILE_PATH");

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

Deno.test("readFile - should read file successfully", async () => {
  const testFile = "./test-temp.txt";
  const testContent = "Test Content";

  // Create test file
  await Deno.writeTextFile(testFile, testContent);

  try {
    const content = await readFile(testFile);
    expect(content).toBe(testContent);
  } finally {
    // Cleanup
    await Deno.remove(testFile);
  }
});

Deno.test("readFile - should throw error for non-existent file", async () => {
  await expect(readFile("./non-existent-file.txt")).rejects.toThrow(
    "Failed to read file",
  );
});
