/**
 * Command-line interface for putrecord.
 *
 * This module provides a CLI wrapper around the library functions with
 * appropriate logging and error handling.
 *
 * @module
 */

import { parseArgs } from "@std/cli";
import { Client, CredentialManager } from "@atcute/client";
import {
  buildRecord,
  createRecord,
  loadConfig,
  readFile,
  uploadRecord,
} from "../src/lib.ts";

const VERSION = "0.1.0";

/**
 * Print help message
 */
function printHelp() {
  console.log(`
putrecord v${VERSION}

Upload files as AT Protocol records to a PDS.

USAGE:
  deno run -A jsr:@fry69/putrecord [OPTIONS]

OPTIONS:
  -q, --quiet     Suppress all non-error output
  -h, --help      Show this help message
  -v, --version   Show version information

CONFIGURATION:
  Configuration is loaded from environment variables:
    PDS_URL       - PDS endpoint (e.g., https://bsky.social)
    IDENTIFIER    - User handle or DID
    APP_PASSWORD  - App password (not main account password)
    COLLECTION    - Lexicon collection in NSID format
    FILE_PATH     - Path to file to upload
    RKEY          - Record key (optional - omit to create new record)

EXAMPLES:
  # Create a new record (without RKEY)
  deno run -A jsr:@fry69/putrecord

  # Update existing record (with RKEY in env)
  deno run -A jsr:@fry69/putrecord

  # Quiet mode (only errors)
  deno run -A jsr:@fry69/putrecord --quiet

For more information, visit: https://github.com/fry69/putrecord
`);
}

/**
 * Print version information
 */
function printVersion() {
  console.log(`putrecord v${VERSION}`);
}

/**
 * Logger that respects quiet mode
 */
class Logger {
  constructor(private quiet: boolean) {}

  log(message: string) {
    if (!this.quiet) {
      console.log(message);
    }
  }

  error(message: string) {
    console.error(message);
  }

  success(message: string) {
    if (!this.quiet) {
      console.log(message);
    }
  }
}

/**
 * Main CLI execution
 */
async function main() {
  // Parse command-line arguments
  const args = parseArgs(Deno.args, {
    boolean: ["quiet", "help", "version"],
    alias: {
      q: "quiet",
      h: "help",
      v: "version",
    },
  });

  // Handle help flag
  if (args.help) {
    printHelp();
    Deno.exit(0);
  }

  // Handle version flag
  if (args.version) {
    printVersion();
    Deno.exit(0);
  }

  const logger = new Logger(args.quiet);

  try {
    // Load configuration
    logger.log("Loading configuration...");
    const config = loadConfig();

    // Read file content
    logger.log(`Reading file: ${config.filePath}`);
    const content = await readFile(config.filePath);
    logger.log(`✓ File read (${content.length} characters)`);

    // Authenticate
    logger.log(`Authenticating as: ${config.identifier}`);
    const manager = new CredentialManager({ service: config.pdsUrl });
    const client = new Client({ handler: manager });

    await manager.login({
      identifier: config.identifier,
      password: config.password,
    });
    logger.log("✓ Authentication successful");

    // Build record from file content
    logger.log("Building record from file content...");
    const record = buildRecord(config.collection, content);

    // Upload or create record based on whether RKEY is provided
    if (config.rkey) {
      logger.log(
        `Updating existing record: ${config.collection}/${config.rkey}...`,
      );
      const result = await uploadRecord(client, config, record);

      logger.success("\n✓ Record updated successfully!");
      logger.log(`  URI: ${result.uri}`);
      logger.log(`  CID: ${result.cid}`);
    } else {
      logger.log(`Creating new record in ${config.collection}...`);
      const result = await createRecord(client, config, record);

      logger.success("\n✓ New record created successfully!");
      logger.log(`  URI: ${result.uri}`);
      logger.log(`  CID: ${result.cid}`);
      logger.log(`  RKEY: ${result.rkey}`);
      logger.log(
        `\n⚠️  Save this RKEY for future updates: ${result.rkey}`,
      );
      logger.log(`   Add to your .env file: RKEY=${result.rkey}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`\n✗ Error: ${message}`);
    Deno.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { main };
