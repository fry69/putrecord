# putrecord

Upload files as AT Protocol records to a PDS. Built with
[atcute](https://github.com/mary-ext/atcute) and Deno.

**Content-neutral**: Works with any AT Protocol collection and content type. No
assumptions about file format or lexicon schema.

## Installation

### As a CLI Tool (Default)

```bash
# Run directly with Deno
deno run -A jsr:@fry69/putrecord

# With options
deno run -A jsr:@fry69/putrecord --quiet
deno run -A jsr:@fry69/putrecord --help
deno run -A jsr:@fry69/putrecord --version
```

### As a Library

```typescript
// Import library functions from JSR
import {
  buildRecord,
  createRecord,
  loadConfig,
  readFile,
  uploadRecord,
} from "jsr:@fry69/putrecord/lib";

// Library functions are quiet by default (no console output)
const config = loadConfig();
const content = await readFile(config.filePath);
const record = buildRecord(config.collection, content);
// ... use createRecord or uploadRecord as needed
```

Or add to your `deno.json`:

```json
{
  "imports": {
    "@fry69/putrecord": "jsr:@fry69/putrecord@^0.1.0",
    "@fry69/putrecord/lib": "jsr:@fry69/putrecord@^0.1.0/lib"
  }
}
```

## Two Modes of Operation

### Create Mode (Manual)

Create a **new** record without specifying an RKEY. The PDS will automatically
generate a timestamp-based RKEY, which you can then save for future updates.

**Use case:** First-time upload of a file.

### Update Mode (Automatic)

Update an **existing** record by providing the RKEY. This overwrites the record
at that specific key.

**Use case:** Updating files via CI/CD workflows.

## Configuration

Environment variables:

- `PDS_URL` - PDS endpoint (e.g., `https://bsky.social`)
- `IDENTIFIER` - Handle or DID (e.g., `alice.bsky.social`)
- `APP_PASSWORD` - App password (not main account password)
- `COLLECTION` - Lexicon collection in NSID format (e.g.,
  `com.example.myapp.record`)
- `RKEY` - Record key (optional - omit for create mode, required for update
  mode)
- `FILE_PATH` - Path to file to upload

## Content Handling

The script intelligently handles different content types:

- **JSON with `$type` field**: Used as-is as the record (for custom lexicon
  schemas)
- **Other content**: Wrapped in a simple structure with `$type`, `content`, and
  `createdAt` fields

This allows flexibility to work with any AT Protocol collection.

## CLI Commands

### Upload Command (Default)

Upload a file to PDS using environment configuration:

```bash
deno run -A jsr:@fry69/putrecord [OPTIONS]
```

### Init Command

Initialize GitHub Actions workflow and configuration files:

```bash
deno run -A jsr:@fry69/putrecord init [OPTIONS]
```

Creates:

- `.github/workflows/putrecord.yaml` - GitHub Actions workflow
- `.env.example` - Environment configuration template

## CLI Options

- `-q, --quiet` - Suppress informational output (only errors are shown)
- `-f, --force` - Overwrite existing files (for init command)
- `-h, --help` - Show usage information
- `-v, --version` - Show version number

Examples:

```bash
# Initialize project (safe - won't overwrite existing files)
deno run -A jsr:@fry69/putrecord init

# Initialize and overwrite existing files
deno run -A jsr:@fry69/putrecord init --force

# Upload with quiet mode (useful for automation)
deno run -A jsr:@fry69/putrecord --quiet

# Show help
deno run -A jsr:@fry69/putrecord --help
```

## Usage

### Create Mode (First Upload)

1. Create `.env` **without** RKEY:

```bash
PDS_URL=https://bsky.social
IDENTIFIER=alice.bsky.social
APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
COLLECTION=com.example.note
FILE_PATH=./content/note.txt
```

2. Create your file:

```bash
mkdir -p content
echo "This is my first note." > content/note.txt
```

3. Upload and get the generated RKEY:

```bash
deno task upload
```

Output will show:

```
✓ New record created successfully!

⚠️  Save this RKEY for future updates: 3l4k2j3h4k5l
   Add to your .env file: RKEY=3l4k2j3h4k5l
```

4. Add the RKEY to your `.env` for future updates:

```bash
echo "RKEY=3l4k2j3h4k5l" >> .env
```

### Update Mode (Subsequent Updates)

Once you have an RKEY, subsequent runs will update the existing record:

```bash
# Edit your file
echo "This is my updated note." > content/note.txt

# Upload (will update the existing record)
deno task upload
```

### Using Custom JSON Records

For collections with custom schemas, provide a JSON file with the `$type` field:

```json
{
  "$type": "com.example.myapp.post",
  "title": "My Post",
  "content": "Post content here",
  "tags": ["tag1", "tag2"],
  "metadata": {
    "author": "Alice",
    "date": "2025-10-08"
  }
}
```

The script will use this structure as-is for your record.

### Quick Setup with Init Command

The easiest way to set up GitHub Actions automation:

```bash
# Initialize workflow and .env.example in your repository
deno run -A jsr:@fry69/putrecord init
```

This creates:

- `.github/workflows/putrecord.yaml` - GitHub Actions workflow
- `.env.example` - Configuration template

Then configure your secrets and you're ready to go!

### GitHub Actions (Automated Updates)

To automate uploads via GitHub Actions:

**Option 1: Using the init command (recommended)**

```bash
# Initialize project files
deno run -A jsr:@fry69/putrecord init

# Copy .env.example to .env and configure
cp .env.example .env
# Edit .env with your credentials
```

**Option 2: Manual setup**

```bash
# Copy workflow from repository
mkdir -p .github/workflows
cp workflow.yaml .github/workflows/putrecord.yaml
```

**Configure repository secrets** using GitHub CLI:

```bash
# Set all secrets from your .env file
gh secret set -f .env
```

Or manually via GitHub web interface: Settings → Secrets and variables → Actions

3. **Customize the workflow** (optional):

   - Edit `.github/workflows/putrecord.yaml`
   - Modify trigger conditions (branches, paths, schedule, etc.)
   - Add additional steps as needed

4. **Push to trigger**: Changes pushed to your main branch will automatically
   upload to PDS.

## Testing

### Unit Tests

```bash
deno task test
```

Unit tests cover basic functionality and error handling.

### End-to-End Tests

E2E tests run against a real PDS if `.env.e2e` exists:

```bash
deno task test:e2e
```

These tests verify:

- Creating new records (without RKEY)
- Updating existing records (with RKEY)
- Error handling

The E2E tests automatically clean up created records.

## Library API

All library functions are **quiet by default** - they do not write to console.
This makes them ideal for programmatic usage, automation, and workflows.

### `loadConfig(): Config`

Loads and validates environment variables. RKEY is optional.

**Returns**: `Config` object with `pdsUrl`, `identifier`, `appPassword`,
`collection`, `rkey?`, and `filePath`.

**Throws**: Error if required environment variables are missing.

### `readFile(path: string): Promise<string>`

Reads file content as text.

**Returns**: File content as string.

**Throws**: Error if file cannot be read.

### `buildRecord(collection: string, content: string): Record<string, unknown>`

Builds an AT Protocol record from content:

- If content is JSON with `$type` field: Uses the JSON as-is
- Otherwise: Wraps content in a structure with `$type`, `content`, and
  `createdAt` fields

**Returns**: Record object ready for AT Protocol.

**Throws**: Error if content is invalid JSON (when attempting to parse).

### `createRecord(client, config, record): Promise<{ uri, cid, rkey }>`

Creates a new record via `com.atproto.repo.createRecord`. Returns the
auto-generated RKEY.

**Returns**: Object with `uri`, `cid`, and `rkey` from the PDS response.

**Throws**: Error if record creation fails.

### `uploadRecord(client, config, record): Promise<{ uri, cid }>`

Updates an existing record via `com.atproto.repo.putRecord`. Requires RKEY in
config.

**Returns**: Object with `uri` and `cid` from the PDS response.

**Throws**: Error if RKEY is not provided or update fails.

## CLI vs Library

- **CLI (`jsr:@fry69/putrecord`)**: Default entry point. User-friendly
  command-line interface with interactive output. Use `--quiet` flag to suppress
  non-error messages.
- **Library (`jsr:@fry69/putrecord/lib`)**: Pure functions with no console
  output. Use in code, automation, workflows.

## Repository Files

- **`src/main.ts`** - CLI entry point with interactive output and argument
  parsing
- **`src/lib.ts`** - Library module with core functions (no console output)
- **`src/templates.ts`** - Inlined templates for init command
- **`tests/lib.test.ts`** - Unit tests for library functions
- **`tests/lib.e2e.test.ts`** - End-to-end integration tests
- **`workflow.yaml`** - Example GitHub Actions workflow (reference copy)
- **`.env.example`** - Example environment configuration (reference copy)
- **`deno.json`** - Deno configuration with tasks and dependencies

## Development

### Template Maintenance

⚠️ **Important**: The `init` command uses inlined templates for reliability and
offline support. When updating templates, you must update **both** locations:

1. **Inlined templates** in `src/templates.ts`:
   - `WORKFLOW_TEMPLATE` - GitHub Actions workflow
   - `ENV_EXAMPLE_TEMPLATE` - Environment configuration

2. **Repository files** (reference copies):
   - `workflow.yaml` - Workflow example in repository root
   - `.env.example` - Environment example in repository root

Keep these in sync to ensure users get consistent templates whether they use
`init` command or manual setup.

## License

MIT
