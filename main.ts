/**
 * Minimal script to upload a file to a PDS via AT Protocol.
 * Uses atcute library for authentication and record operations.
 */

import { Client, CredentialManager, ok } from "@atcute/client";
import type {} from "@atcute/whitewind"; // Import WhiteWind types
import type {} from "@atcute/atproto"; // Import AT Protocol types
import type { ActorIdentifier, Nsid } from "@atcute/lexicons";

/**
 * Configuration loaded from environment variables
 */
interface Config {
  pdsUrl: string;
  identifier: string; // Handle or DID
  password: string; // App password
  collection: string; // e.g., "com.whtwnd.blog.entry"
  rkey: string; // Record key
  filePath: string; // Path to file to upload
}

/**
 * Load and validate configuration from environment
 */
function loadConfig(): Config {
  const required = [
    "PDS_URL",
    "IDENTIFIER",
    "APP_PASSWORD",
    "COLLECTION",
    "RKEY",
    "FILE_PATH",
  ];

  for (const key of required) {
    if (!Deno.env.get(key)) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    pdsUrl: Deno.env.get("PDS_URL")!,
    identifier: Deno.env.get("IDENTIFIER")!,
    password: Deno.env.get("APP_PASSWORD")!,
    collection: Deno.env.get("COLLECTION")!,
    rkey: Deno.env.get("RKEY")!,
    filePath: Deno.env.get("FILE_PATH")!,
  };
}

/**
 * Read file content
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
 * Create a blog entry record for WhiteWind
 */
function createBlogRecord(content: string): Record<string, unknown> {
  return {
    $type: "com.whtwnd.blog.entry",
    content,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Upload record to PDS
 */
async function uploadRecord(
  client: Client,
  config: Config,
  record: Record<string, unknown>,
): Promise<{ uri: string; cid: string }> {
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

  console.log(`✓ Record uploaded successfully`);
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

    // Create and upload record
    console.log(`Creating blog entry record...`);
    const record = createBlogRecord(content);

    console.log(`Uploading to ${config.collection}/${config.rkey}...`);
    await uploadRecord(client, config, record);

    console.log("\n✓ Upload complete!");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("\n✗ Error:", message);
    Deno.exit(1);
  }
}

// Export functions for testing
export { createBlogRecord, loadConfig, readFile, uploadRecord };

// Run if executed directly
if (import.meta.main) {
  main();
}
