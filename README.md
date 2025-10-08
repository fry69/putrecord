# putrecord

Upload files as AT Protocol records to a PDS. Built with
[atcute](https://github.com/mary-ext/atcute) and Deno.

**Content-neutral**: Works with any AT Protocol collection and content type. No
assumptions about file format or lexicon schema.

## Installation

### As a CLI Tool

```bash
# Run directly with Deno
deno run -A jsr:@fry69/putrecord
```

### As a Library

```typescript
// Import from JSR
import { buildRecord, createRecord, uploadRecord } from "jsr:@fry69/putrecord";
```

Or add to your `deno.json`:

```json
{
  "imports": {
    "@fry69/putrecord": "jsr:@fry69/putrecord@^0.1.0"
  }
}
```

### Clone from GitHub

```bash
git clone https://github.com/fry69/putrecord.git
cd putrecord
deno task upload
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

### GitHub Actions (Automated Updates)

To automate uploads via GitHub Actions:

1. **Copy the example workflow** to your repository:

```bash
mkdir -p .github/workflows
cp workflow.yaml .github/workflows/putrecord.yaml
```

2. **Configure repository secrets** using GitHub CLI:

```bash
# Set all secrets from your .env file
gh secret set -f .env

# Or using deno task
deno task secrets
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

## API

### `loadConfig(): Config`

Loads and validates environment variables. RKEY is optional.

### `readFile(path: string): Promise<string>`

Reads file content as text.

### `buildRecord(collection: string, content: string): Record<string, unknown>`

Builds an AT Protocol record from content:

- If content is JSON with `$type` field: Uses the JSON as-is
- Otherwise: Wraps content in a structure with `$type`, `content`, and
  `createdAt` fields

### `createRecord(client, config, record): Promise<{ uri, cid, rkey }>`

Creates a new record via `com.atproto.repo.createRecord`. Returns the
auto-generated RKEY.

### `uploadRecord(client, config, record): Promise<{ uri, cid }>`

Updates an existing record via `com.atproto.repo.putRecord`. Requires RKEY in
config.

## Repository Files

- **`main.ts`** - Main script with upload logic
- **`main.test.ts`** - Unit tests
- **`main.e2e.test.ts`** - End-to-end integration tests
- **`workflow.yaml`** - Example GitHub Actions workflow (copy to
  `.github/workflows/` to use)
- **`.env.example`** - Example environment configuration
- **`deno.json`** - Deno configuration with tasks and dependencies

## License

MIT
