# Migration Guide: v1 → v2

This guide helps you migrate from the old overengineered version to the new
minimal implementation.

## Key Changes

### 1. No More State File

**Old (v1):**

```json
{
  "pds_url": "https://altq.net",
  "did": "did:plc:xxx",
  "handle": "user.bsky.social",
  "collection": "com.whtwnd.blog.entry",
  "path": "posts",
  "files": [{ "name": "blog-post.md", "rkey": "3lqyx2g4fk42z" }]
}
```

**New (v2):**

- Configuration via environment variables only
- No tracking of multiple files
- Explicit single file → single record mapping

### 2. Environment Variables

**Old (v1):**

```bash
APP_PASSWORD=your-password
# Everything else in state.json
```

**New (v2):**

```bash
PDS_URL=https://bsky.social
IDENTIFIER=user.bsky.social
APP_PASSWORD=your-password
COLLECTION=com.whtwnd.blog.entry
RKEY=specific-post-key
MARKDOWN_PATH=./posts/blog-post.md
```

### 3. GitHub Secrets

**Old (v1):**

- `APP_PASSWORD`
- `PDS_URL`
- `DID`
- `HANDLE`

**New (v2):**

- `PDS_URL`
- `IDENTIFIER` (replaces both DID and HANDLE)
- `APP_PASSWORD`
- `COLLECTION`
- `RKEY`
- `MARKDOWN_PATH`

### 4. Workflow Changes

**Old (v1):**

- Scanned directory for all `.md` files
- Tracked state in `state.json`
- Updated existing or created new records
- Added timestamps to content

**New (v2):**

- Uploads single specified file
- No state tracking
- Always uses `putRecord` with specified rkey
- No content modification

## Migration Steps

### Step 1: Update Environment Variables

Create a `.env` file with all required variables:

```bash
cp .env.example .env
# Edit .env with your values
```

### Step 2: Update GitHub Secrets

In your GitHub repository settings:

1. Keep existing secrets:

   - `APP_PASSWORD` (no change)
   - `PDS_URL` (no change)

2. Add new secrets:

   - `IDENTIFIER` = your `HANDLE` from old setup
   - `COLLECTION` = `com.whtwnd.blog.entry` (or your collection)
   - `RKEY` = the rkey from your `state.json` for the file you want to continue
     updating
   - `MARKDOWN_PATH` = `./posts/blog-post.md` (or your file path)

3. Remove old secrets (optional cleanup):
   - `DID`
   - `HANDLE`

### Step 3: Choose Your rkey

Look at your old `state.json`:

```json
{
  "files": [{ "name": "blog-post.md", "rkey": "3lqyx2g4fk42z" }]
}
```

Use the existing `rkey` to continue updating the same record, or choose a new
one.

### Step 4: Test Locally

```bash
deno task check  # Verify code quality
deno task test   # Run all tests
deno task upload # Test upload (requires valid credentials)
```

### Step 5: Clean Up (Optional)

Remove files that are no longer needed:

```bash
rm state.json state-template.json
```

Note: Keep `.env.template` if you want, but `.env.example` is the new
recommended template.

## Feature Comparison

| Feature             | Old (v1)         | New (v2)       |
| ------------------- | ---------------- | -------------- |
| Multi-file support  | ✅               | ❌             |
| State tracking      | ✅               | ❌             |
| Content comparison  | ✅               | ❌             |
| Timestamp injection | ✅               | ❌             |
| Configuration       | State file + env | Env only       |
| Library             | @atproto/api     | @atcute/client |
| Tests               | ❌               | ✅             |
| Bundle size         | Larger           | Minimal        |

## Why the Changes?

The new version prioritizes:

1. **Simplicity**: Single file upload is the core use case
2. **Testability**: All functions are independently testable
3. **Clarity**: No hidden state or complex logic
4. **Maintainability**: Smaller codebase, easier to understand

## Need Multi-File Support?

If you need to upload multiple files, you have two options:

### Option 1: Multiple Workflows (Recommended)

Create separate workflows for each file:

```yaml
# .github/workflows/upload-post-1.yaml
- name: Upload Post 1
  env:
    RKEY: post-1
    MARKDOWN_PATH: ./posts/post-1.md
  run: deno task upload
```

### Option 2: Shell Script

Create a simple shell script:

```bash
#!/bin/bash
for file in posts/*.md; do
  export MARKDOWN_PATH="$file"
  export RKEY=$(basename "$file" .md)
  deno task upload
done
```

## Getting Help

- Review the new [README.md](./README.md) for full documentation
- Check the [examples](./README.md#example-whitewind-blog) section
- Open an issue if you have migration questions

## Rollback

If you need to go back to the old version:

```bash
git checkout <old-commit-hash>
```

The old `state.json` should still work with the old code.
