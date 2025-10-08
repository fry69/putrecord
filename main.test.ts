/**
 * Unit tests for lib.ts functions
 */

import { expect } from "@std/expect";
import { buildRecord, loadConfig, readFile } from "./lib.ts";

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
