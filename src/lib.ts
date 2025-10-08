/**
 * Upload files as AT Protocol records to a PDS.
 *
 * This module provides functionality to create and update records in any AT
 * Protocol collection. It supports two modes: create mode (without RKEY) for
 * new records, and update mode (with RKEY) for existing records.
 *
 * @example
 * ```ts
 * import { buildRecord, createRecord } from "@fry69/putrecord";
 * import { Client, CredentialManager } from "@atcute/client";
 *
 * // Setup client
 * const manager = new CredentialManager({ service: "https://bsky.social" });
 * const client = new Client({ handler: manager });
 * await manager.login({ identifier: "user.bsky.social", password: "app-password" });
 *
 * // Create a record
 * const record = buildRecord("com.example.note", "My first note");
 * const result = await createRecord(client, config, record);
 * console.log("Created with RKEY:", result.rkey);
 * ```
 *
 * @module
 */

import { ok } from "@atcute/client";
import type { Client } from "@atcute/client";
import type {} from "@atcute/atproto"; // Import AT Protocol types
import type { ActorIdentifier, Nsid } from "@atcute/lexicons";

/**
 * Configuration for uploading records to a PDS.
 *
 * This interface defines the required settings loaded from environment
 * variables or provided programmatically.
 */
interface Config {
  /** PDS endpoint URL (e.g., "https://bsky.social") */
  pdsUrl: string;
  /** User handle or DID (e.g., "alice.bsky.social" or "did:plc:...") */
  identifier: string;
  /** App password for authentication (not the main account password) */
  password: string;
  /** Lexicon collection in NSID format (e.g., "com.example.note") */
  collection: string;
  /**
   * Record key for updating existing records.
   *
   * Optional - if not provided, a new record will be created with an
   * auto-generated RKEY.
   */
  rkey?: string;
  /** Path to the file to upload */
  filePath: string;
}

/**
 * Load and validate configuration from environment variables.
 *
 * Reads required environment variables and validates they are present.
 * RKEY is optional - if not provided, a new record will be created.
 *
 * @returns The validated configuration object
 * @throws {Error} If any required environment variable is missing
 *
 * @example
 * ```ts
 * // Set environment variables first
 * Deno.env.set("PDS_URL", "https://bsky.social");
 * Deno.env.set("IDENTIFIER", "alice.bsky.social");
 * Deno.env.set("APP_PASSWORD", "xxxx-xxxx-xxxx-xxxx");
 * Deno.env.set("COLLECTION", "com.example.note");
 * Deno.env.set("FILE_PATH", "./note.txt");
 *
 * const config = loadConfig();
 * ```
 */
function loadConfig(): Config {
  const required = [
    "PDS_URL",
    "IDENTIFIER",
    "APP_PASSWORD",
    "COLLECTION",
    "FILE_PATH",
  ];

  for (const key of required) {
    if (!Deno.env.get(key)) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const rkey = Deno.env.get("RKEY");

  return {
    pdsUrl: Deno.env.get("PDS_URL")!,
    identifier: Deno.env.get("IDENTIFIER")!,
    password: Deno.env.get("APP_PASSWORD")!,
    collection: Deno.env.get("COLLECTION")!,
    rkey: rkey || undefined,
    filePath: Deno.env.get("FILE_PATH")!,
  };
}

/**
 * Read file content as text.
 *
 * Reads the entire file content using UTF-8 encoding.
 *
 * @param path The absolute or relative path to the file
 * @returns The file content as a string
 * @throws {Error} If the file cannot be read or doesn't exist
 *
 * @example
 * ```ts
 * const content = await readFile("./note.txt");
 * console.log(`Read ${content.length} characters`);
 * ```
 */
async function readFile(path: string): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read file ${path}: ${message}`);
  }
}

/**
 * Extract title from markdown content (first # heading).
 * @param content Markdown content
 * @returns Title string or undefined if no heading found
 */
function extractMarkdownTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

/**
 * Fetch an existing record from the PDS.
 *
 * @param client The authenticated AT Protocol client
 * @param config The configuration containing repository, collection, and RKEY
 * @returns The existing record data, or null if not found
 */
async function getRecord(
  client: Client,
  config: Config,
): Promise<Record<string, unknown> | null> {
  if (!config.rkey) {
    return null;
  }

  try {
    const response = await ok(
      client.get("com.atproto.repo.getRecord", {
        params: {
          repo: config.identifier as ActorIdentifier,
          collection: config.collection as Nsid,
          rkey: config.rkey,
        },
      }),
    );

    return response.value as Record<string, unknown>;
  } catch {
    // Record doesn't exist or error fetching
    return null;
  }
}

/**
 * Build an AT Protocol record from file content.
 *
 * This function intelligently handles different content types:
 * - If content is valid JSON with a `$type` field, it uses the JSON as-is
 * - For WhiteWind blog entries (com.whtwnd.blog.entry), it creates a proper
 *   blog record with required `visibility` field and optional `title`
 * - Otherwise, it wraps the content in a simple structure with `$type`,
 *   `content`, and `createdAt` fields
 *
 * When updating existing records (existingRecord provided), the function
 * preserves existing `title` and `visibility` fields unless forceFields is true.
 *
 * This allows flexibility to work with any AT Protocol collection and custom
 * lexicon schemas.
 *
 * @param collection The lexicon collection NSID (e.g., "com.example.note")
 * @param content The file content to convert into a record
 * @param existingRecord Optional existing record data (for updates)
 * @param forceFields If true, always extract/set fields even if they exist
 * @returns An AT Protocol record ready to upload
 *
 * @example Simple text content
 * ```ts
 * const record = buildRecord("com.example.note", "My note text");
 * // Returns: { $type: "com.example.note", content: "My note text", createdAt: "..." }
 * ```
 *
 * @example WhiteWind blog entry (automatic handling)
 * ```ts
 * const markdown = "# My Blog Post\n\nContent here";
 * const record = buildRecord("com.whtwnd.blog.entry", markdown);
 * // Returns: {
 * //   $type: "com.whtwnd.blog.entry",
 * //   content: "# My Blog Post\n\nContent here",
 * //   title: "My Blog Post",
 * //   visibility: "public",
 * //   createdAt: "..."
 * // }
 * ```
 *
 * @example Custom JSON schema
 * ```ts
 * const jsonContent = JSON.stringify({
 *   $type: "com.example.post",
 *   title: "My Post",
 *   body: "Content here"
 * });
 * const record = buildRecord("com.example.post", jsonContent);
 * // Returns: { $type: "com.example.post", title: "My Post", body: "Content here" }
 * ```
 */
function buildRecord(
  collection: string,
  content: string,
  existingRecord?: Record<string, unknown>,
  forceFields = false,
): Record<string, unknown> {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(content);
    // If it's an object and has $type, use it directly
    if (
      typeof parsed === "object" && parsed !== null &&
      typeof parsed.$type === "string"
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Not JSON, continue with collection-specific handling
  }

  // Special handling for WhiteWind blog entries
  if (collection === "com.whtwnd.blog.entry") {
    const extractedTitle = extractMarkdownTitle(content);
    const record: Record<string, unknown> = {
      $type: collection,
      content,
      createdAt: new Date().toISOString(),
    };

    // Handle visibility field
    if (existingRecord && !forceFields && existingRecord.visibility) {
      // Preserve existing visibility
      record.visibility = existingRecord.visibility;
    } else {
      // Set default visibility
      record.visibility = "public";
    }

    // Handle title field
    if (existingRecord && !forceFields && existingRecord.title) {
      // Preserve existing title
      record.title = existingRecord.title;
    } else if (extractedTitle) {
      // Use extracted title
      record.title = extractedTitle;
    }

    return record;
  }

  // Create a simple generic record for other collections
  return {
    $type: collection,
    content,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a new record in the PDS with an auto-generated RKEY.
 *
 * This function uses `com.atproto.repo.createRecord` to create a new record.
 * The PDS automatically generates a timestamp-based RKEY (TID), which is
 * returned for future updates.
 *
 * @param client The authenticated AT Protocol client
 * @param config The configuration containing repository and collection info
 * @param record The record data to upload
 * @returns An object containing the URI, CID, and generated RKEY
 *
 * @example
 * ```ts
 * const record = buildRecord("com.example.note", "My first note");
 * const result = await createRecord(client, config, record);
 * console.log(`Created with RKEY: ${result.rkey}`);
 * console.log(`URI: ${result.uri}`);
 * // Save result.rkey for future updates!
 * ```
 */
async function createRecord(
  client: Client,
  config: Config,
  record: Record<string, unknown>,
): Promise<{ uri: string; cid: string; rkey: string }> {
  const response = await ok(
    client.post("com.atproto.repo.createRecord", {
      input: {
        repo: config.identifier as ActorIdentifier,
        collection: config.collection as Nsid,
        record,
      },
    }),
  );

  // Extract rkey from URI (format: at://did:plc:.../collection/rkey)
  const rkey = response.uri.split("/").pop() || "";

  return { uri: response.uri, cid: response.cid, rkey };
}

/**
 * Update an existing record in the PDS.
 *
 * This function uses `com.atproto.repo.putRecord` to overwrite an existing
 * record at the specified RKEY. The RKEY must be provided in the config.
 *
 * @param client The authenticated AT Protocol client
 * @param config The configuration containing repository, collection, and RKEY
 * @param record The updated record data to upload
 * @returns An object containing the URI and CID of the updated record
 * @throws {Error} If RKEY is not provided in the config
 *
 * @example
 * ```ts
 * const record = buildRecord("com.example.note", "Updated note text");
 * const result = await uploadRecord(client, config, record);
 * console.log(`Updated record at: ${result.uri}`);
 * ```
 */
async function uploadRecord(
  client: Client,
  config: Config,
  record: Record<string, unknown>,
): Promise<{ uri: string; cid: string }> {
  if (!config.rkey) {
    throw new Error("RKEY is required for updating records");
  }

  const response = await ok(
    client.post("com.atproto.repo.putRecord", {
      input: {
        repo: config.identifier as ActorIdentifier,
        collection: config.collection as Nsid,
        rkey: config.rkey,
        record,
      },
    }),
  );

  return { uri: response.uri, cid: response.cid };
}

// Export all library functions
export {
  buildRecord,
  createRecord,
  getRecord,
  loadConfig,
  readFile,
  uploadRecord,
};

// Export types for users who need them
export type { Config };
