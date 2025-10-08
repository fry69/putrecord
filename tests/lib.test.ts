/**
 * Unit tests for lib.ts functions
 */

import { expect } from "@std/expect";
import { buildRecord, loadConfig, readFile } from "../src/lib.ts";
import { joinPath } from "./test_utils.ts";

Deno.test("loadConfig - should load all required environment variables with RKEY", () => {
  // Set up environment
  Deno.env.set("PDS_URL", "https://test.pds");
  Deno.env.set("IDENTIFIER", "test.handle");
  Deno.env.set("APP_PASSWORD", "test-pass");
  Deno.env.set("COLLECTION", "com.example.note");
  Deno.env.set("RKEY", "test-rkey");
  Deno.env.set("FILE_PATH", "./test.md");

  const config = loadConfig();

  expect(config.pdsUrl).toBe("https://test.pds");
  expect(config.identifier).toBe("test.handle");
  expect(config.password).toBe("test-pass");
  expect(config.collection).toBe("com.example.note");
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
  Deno.env.set("COLLECTION", "com.example.note");
  Deno.env.set("FILE_PATH", "./test.md");

  const config = loadConfig();

  expect(config.pdsUrl).toBe("https://test.pds");
  expect(config.identifier).toBe("test.handle");
  expect(config.password).toBe("test-pass");
  expect(config.collection).toBe("com.example.note");
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

Deno.test("buildRecord - should create generic record from text content", () => {
  const collection = "com.example.note";
  const content = "This is a simple text note.";
  const record = buildRecord(collection, content);

  expect(record.$type).toBe(collection);
  expect(record.content).toBe(content);
  expect(typeof record.createdAt).toBe("string");

  // Validate ISO timestamp
  const timestamp = new Date(record.createdAt as string);
  expect(timestamp).toBeInstanceOf(Date);
  expect(timestamp.getTime()).not.toBeNaN();
});

Deno.test("buildRecord - should use JSON content as-is if it has $type", () => {
  const collection = "com.example.post";
  const jsonContent = JSON.stringify({
    $type: "com.example.custom",
    title: "Custom Title",
    body: "Custom Body",
    customField: 123,
  });

  const record = buildRecord(collection, jsonContent);

  expect(record.$type).toBe("com.example.custom");
  expect(record.title).toBe("Custom Title");
  expect(record.body).toBe("Custom Body");
  expect(record.customField).toBe(123);
  expect(record.createdAt).toBeUndefined(); // Should not add createdAt for JSON with $type
});

Deno.test("buildRecord - should wrap JSON without $type", () => {
  const collection = "com.example.data";
  const jsonContent = JSON.stringify({
    title: "Some Data",
    value: 42,
  });

  const record = buildRecord(collection, jsonContent);

  expect(record.$type).toBe(collection);
  expect(record.content).toBe(jsonContent);
  expect(typeof record.createdAt).toBe("string");
});

Deno.test("buildRecord - should handle WhiteWind blog entry with title", () => {
  const collection = "com.whtwnd.blog.entry";
  const markdown = "# My Blog Post\n\nThis is the content of my blog post.";

  const record = buildRecord(collection, markdown);

  expect(record.$type).toBe("com.whtwnd.blog.entry");
  expect(record.content).toBe(markdown);
  expect(record.visibility).toBe("public");
  expect(record.title).toBe("My Blog Post");
  expect(typeof record.createdAt).toBe("string");
});

Deno.test("buildRecord - should handle WhiteWind blog entry without title", () => {
  const collection = "com.whtwnd.blog.entry";
  const markdown = "Just some content without a heading.";

  const record = buildRecord(collection, markdown);

  expect(record.$type).toBe("com.whtwnd.blog.entry");
  expect(record.content).toBe(markdown);
  expect(record.visibility).toBe("public");
  expect(record.title).toBeUndefined();
  expect(typeof record.createdAt).toBe("string");
});

Deno.test("buildRecord - should respect WhiteWind JSON with custom visibility", () => {
  const collection = "com.whtwnd.blog.entry";
  const jsonContent = JSON.stringify({
    $type: "com.whtwnd.blog.entry",
    content: "# Custom Post",
    visibility: "author", // Custom visibility
    title: "Custom Title",
    theme: "dark",
    createdAt: "2025-01-01T00:00:00.000Z",
  });

  const record = buildRecord(collection, jsonContent);

  // Should use the JSON as-is since it has $type
  expect(record.$type).toBe("com.whtwnd.blog.entry");
  expect(record.visibility).toBe("author");
  expect(record.title).toBe("Custom Title");
  expect(record.theme).toBe("dark");
  expect(record.createdAt).toBe("2025-01-01T00:00:00.000Z");
});

Deno.test("buildRecord - should preserve existing title on update", () => {
  const collection = "com.whtwnd.blog.entry";
  const markdown = "# New Title\n\nUpdated content.";
  const existingRecord = {
    $type: "com.whtwnd.blog.entry",
    content: "# Old Title\n\nOld content.",
    title: "Existing Custom Title",
    visibility: "public",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  const record = buildRecord(collection, markdown, existingRecord, false);

  // Should preserve existing title
  expect(record.$type).toBe("com.whtwnd.blog.entry");
  expect(record.title).toBe("Existing Custom Title");
  expect(record.visibility).toBe("public");
  expect(record.content).toBe(markdown);
});

Deno.test("buildRecord - should preserve existing visibility on update", () => {
  const collection = "com.whtwnd.blog.entry";
  const markdown = "# My Post\n\nContent here.";
  const existingRecord = {
    $type: "com.whtwnd.blog.entry",
    content: "# My Post\n\nOld content.",
    title: "My Post",
    visibility: "author", // Private visibility
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  const record = buildRecord(collection, markdown, existingRecord, false);

  // Should preserve existing visibility
  expect(record.$type).toBe("com.whtwnd.blog.entry");
  expect(record.visibility).toBe("author");
  expect(record.title).toBe("My Post");
});

Deno.test("buildRecord - should force extract title when forceFields is true", () => {
  const collection = "com.whtwnd.blog.entry";
  const markdown = "# New Title From Markdown\n\nUpdated content.";
  const existingRecord = {
    $type: "com.whtwnd.blog.entry",
    content: "# Old Title\n\nOld content.",
    title: "Existing Custom Title",
    visibility: "author",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  const record = buildRecord(collection, markdown, existingRecord, true);

  // Should extract title from markdown and reset visibility
  expect(record.$type).toBe("com.whtwnd.blog.entry");
  expect(record.title).toBe("New Title From Markdown");
  expect(record.visibility).toBe("public"); // Reset to default
  expect(record.content).toBe(markdown);
});

Deno.test("buildRecord - should handle update with no existing title or visibility", () => {
  const collection = "com.whtwnd.blog.entry";
  const markdown = "# New Title\n\nContent.";
  const existingRecord = {
    $type: "com.whtwnd.blog.entry",
    content: "Old content without title.",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  const record = buildRecord(collection, markdown, existingRecord, false);

  // Should extract title and set default visibility since they don't exist
  expect(record.$type).toBe("com.whtwnd.blog.entry");
  expect(record.title).toBe("New Title");
  expect(record.visibility).toBe("public");
});

Deno.test("readFile - should read file successfully", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "putrecord_test_" });

  try {
    const testFile = joinPath(tempDir, "test-file.txt");
    const testContent = "Test Content";

    // Create test file
    await Deno.writeTextFile(testFile, testContent);

    const content = await readFile(testFile);
    expect(content).toBe(testContent);
  } finally {
    // Cleanup
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});

Deno.test("readFile - should throw error for non-existent file", async () => {
  await expect(readFile("./non-existent-file.txt")).rejects.toThrow(
    "Failed to read file",
  );
});
