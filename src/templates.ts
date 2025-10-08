/**
 * Template files for the init command.
 *
 * IMPORTANT MAINTENANCE NOTE:
 * These inlined templates must be kept in sync with the example files in the repository:
 * - WORKFLOW_TEMPLATE ↔ workflow.yaml
 * - ENV_EXAMPLE_TEMPLATE ↔ .env.example
 *
 * When updating these templates, update both the inlined version here AND the repository files.
 *
 * @module
 */

/**
 * GitHub Actions workflow template for automatic PDS uploads.
 * Keep in sync with workflow.yaml in the repository root.
 */
export const WORKFLOW_TEMPLATE =
  `# Example GitHub Actions workflow for automatic PDS uploads
# Copy this file to .github/workflows/ in your repository to use it
name: Upload to PDS

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          cache: true
          deno-version: v2.x

      - name: Upload to PDS
        env:
          PDS_URL: \${{ secrets.PDS_URL }}
          IDENTIFIER: \${{ secrets.IDENTIFIER }}
          APP_PASSWORD: \${{ secrets.APP_PASSWORD }}
          COLLECTION: \${{ secrets.COLLECTION }}
          RKEY: \${{ secrets.RKEY }}
          FILE_PATH: \${{ secrets.FILE_PATH }}
        run: deno run -A jsr:@fry69/putrecord --quiet
`;

/**
 * Environment configuration template.
 * Keep in sync with .env.example in the repository root.
 */
export const ENV_EXAMPLE_TEMPLATE = `# PDS Configuration
PDS_URL=https://bsky.social

# Authentication
IDENTIFIER=your-handle.bsky.social
APP_PASSWORD=your-app-password-here

# Record Configuration
# Use any valid AT Protocol collection (NSID format)
COLLECTION=com.example.note

# RKEY (optional)
# - Omit or comment out for CREATE mode (first upload)
# - Set for UPDATE mode (subsequent uploads)
# RKEY=your-generated-rkey-here

# File Path
# Can be text, JSON, or any content supported by your collection
FILE_PATH=./content/note.txt
`;
