/**
 * Minimal script to upload a file to a PDS via AT Protocol.
 * Uses atcute library for authentication and record operations.
 */

import { Client, CredentialManager, ok } from "@atcute/client";
import type {} from "@atcute/atproto"; // Import AT Protocol types
import type { ActorIdentifier, Nsid } from "@atcute/lexicons";

/**
 * Configuration loaded from environment variables
 */
interface Config {
  pdsUrl: string;
  identifier: string; // Handle or DID
  password: string; // App password
  collection: string; // Lexicon collection (NSID format)
  rkey?: string; // Record key (optional - if not provided, creates new record)
  filePath: string; // Path to file to upload
}

/**
 * Load and validate configuration from environment
 * RKEY is optional - if not provided, a new record will be created
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
 * Read file content as text
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
 * Create a generic AT Protocol record from file content
 * If content is valid JSON with $type field, use it as-is
 * Otherwise, create a simple record structure
 */
function buildRecord(
  collection: string,
  content: string,
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
    // Not JSON, continue with simple structure
  }

  // Create a simple generic record
  return {
    $type: collection,
    content,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a new record in PDS (generates rkey automatically)
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

  console.log(`✓ Record created successfully`);
  console.log(`  URI: ${response.uri}`);
  console.log(`  CID: ${response.cid}`);
  console.log(`  RKEY: ${rkey}`);

  return { uri: response.uri, cid: response.cid, rkey };
}

/**
 * Update an existing record in PDS (requires rkey)
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

  console.log(`✓ Record updated successfully`);
  console.log(`  URI: ${response.uri}`);
  console.log(`  CID: ${response.cid}`);

  return { uri: response.uri, cid: response.cid };
}

/**
 * Main execution
 */
async function main() {
  try {
    // Load configuration
    console.log("Loading configuration...");
    const config = loadConfig();

    // Read file content
    console.log(`Reading file: ${config.filePath}`);
    const content = await readFile(config.filePath);
    console.log(`✓ File read (${content.length} characters)`);

    // Authenticate
    console.log(`Authenticating as: ${config.identifier}`);
    const manager = new CredentialManager({ service: config.pdsUrl });
    const client = new Client({ handler: manager });

    await manager.login({
      identifier: config.identifier,
      password: config.password,
    });
    console.log("✓ Authentication successful");

    // Build record from file content
    console.log(`Building record from file content...`);
    const record = buildRecord(config.collection, content);

    // Upload or create record based on whether RKEY is provided
    if (config.rkey) {
      console.log(
        `Updating existing record: ${config.collection}/${config.rkey}...`,
      );
      await uploadRecord(client, config, record);
      console.log("\n✓ Record updated successfully!");
    } else {
      console.log(`Creating new record in ${config.collection}...`);
      const result = await createRecord(client, config, record);
      console.log("\n✓ New record created successfully!");
      console.log(
        `\n⚠️  Save this RKEY for future updates: ${result.rkey}`,
      );
      console.log(
        `   Add to your .env file: RKEY=${result.rkey}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("\n✗ Error:", message);
    Deno.exit(1);
  }
}

// Export functions for testing
export { buildRecord, createRecord, loadConfig, readFile, uploadRecord };

// Run if executed directly
if (import.meta.main) {
  main();
}
