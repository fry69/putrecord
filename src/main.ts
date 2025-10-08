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
import { ENV_EXAMPLE_TEMPLATE, WORKFLOW_TEMPLATE } from "./templates.ts";

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
  deno run -A jsr:@fry69/putrecord init [OPTIONS]

COMMANDS:
  (default)       Upload a file to PDS using environment configuration
  init            Initialize GitHub Actions workflow and .env.example

OPTIONS:
  -q, --quiet     Suppress all non-error output
  -f, --force     Overwrite existing files (for init command)
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
  # Initialize project with GitHub Actions workflow
  deno run -A jsr:@fry69/putrecord init

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
 * Initialize project with GitHub Actions workflow and .env.example
 */
async function initProject(force: boolean, logger: Logger) {
  const workflowDir = ".github/workflows";
  const workflowPath = `${workflowDir}/putrecord.yaml`;
  const envExamplePath = ".env.example";

  logger.log("Initializing putrecord project...\n");

  // Create .github/workflows directory
  try {
    await Deno.mkdir(workflowDir, { recursive: true });
    logger.log(`✓ Created directory: ${workflowDir}`);
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
    logger.log(`✓ Directory exists: ${workflowDir}`);
  }

  // Create workflow file
  try {
    const workflowExists = await Deno.stat(workflowPath)
      .then(() => true)
      .catch(() => false);

    if (workflowExists && !force) {
      logger.log(`⊘ Skipped: ${workflowPath} (already exists)`);
      logger.log(`  Use --force to overwrite`);
    } else {
      await Deno.writeTextFile(workflowPath, WORKFLOW_TEMPLATE);
      logger.success(
        `✓ Created: ${workflowPath}${workflowExists ? " (overwritten)" : ""}`,
      );
    }
  } catch (error) {
    logger.error(`✗ Failed to create ${workflowPath}: ${error}`);
    throw error;
  }

  // Create .env.example file
  try {
    const envExists = await Deno.stat(envExamplePath)
      .then(() => true)
      .catch(() => false);

    if (envExists && !force) {
      logger.log(`⊘ Skipped: ${envExamplePath} (already exists)`);
      logger.log(`  Use --force to overwrite`);
    } else {
      await Deno.writeTextFile(envExamplePath, ENV_EXAMPLE_TEMPLATE);
      logger.success(
        `✓ Created: ${envExamplePath}${envExists ? " (overwritten)" : ""}`,
      );
    }
  } catch (error) {
    logger.error(`✗ Failed to create ${envExamplePath}: ${error}`);
    throw error;
  }

  // Print next steps
  logger.log("\n✓ Initialization complete!\n");
  logger.log("Next steps:");
  logger.log("  1. Copy .env.example to .env and configure your credentials");
  logger.log("  2. Set GitHub repository secrets (see README for details)");
  logger.log("  3. Push changes to trigger the workflow\n");
  logger.log(
    "For more information, visit: https://github.com/fry69/putrecord",
  );
}

/**
 * Main CLI execution
 */
async function main() {
  // Parse command-line arguments
  const args = parseArgs(Deno.args, {
    boolean: ["quiet", "help", "version", "force"],
    alias: {
      q: "quiet",
      h: "help",
      v: "version",
      f: "force",
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

  // Check for subcommand
  const subcommand = args._[0]?.toString();

  // Handle init subcommand
  if (subcommand === "init") {
    try {
      await initProject(args.force, logger);
      Deno.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`\n✗ Initialization failed: ${message}`);
      Deno.exit(1);
    }
  }

  // Default: upload command
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
