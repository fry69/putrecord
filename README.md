# putrecord

Upload files as AT Protocol records to a PDS. Built with
[atcute](https://github.com/mary-ext/atcute) and Deno.

Supports any file type that can be uploaded via AT Protocol.

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
- `COLLECTION` - Lexicon collection (e.g., `com.whtwnd.blog.entry`)
- `RKEY` - Record key (optional - omit for create mode, required for update
  mode)
- `FILE_PATH` - Path to file to upload

## Usage

### Create Mode (First Upload)

1. Create `.env` **without** RKEY:

```bash
PDS_URL=https://bsky.social
IDENTIFIER=alice.bsky.social
APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
COLLECTION=com.whtwnd.blog.entry
FILE_PATH=./posts/blog-post.md
```

2. Create your file:

```bash
mkdir -p posts
echo "# My First Post" > posts/blog-post.md
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
echo "# My Updated Post" > posts/blog-post.md

# Upload (will update the existing record)
deno task upload
```

### GitHub Actions (Automated Updates)

Upload secrets to repository:

```bash
# Using GitHub CLI
gh secret set -f .env

# Or using deno task
deno task secrets
```

Then push changes to trigger upload.

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

Reads file content.

### `createBlogRecord(content: string): Record<string, unknown>`

Creates AT Protocol record with `$type`, `content`, and `createdAt`.

### `createRecord(client, config, record): Promise<{ uri, cid, rkey }>`

Creates a new record via `com.atproto.repo.createRecord`. Returns the
auto-generated RKEY.

### `uploadRecord(client, config, record): Promise<{ uri, cid }>`

Updates an existing record via `com.atproto.repo.putRecord`. Requires RKEY in
config.

## License

MIT
