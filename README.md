# putrecord

Upload files as AT Protocol records to a PDS. **Content-neutral** design works
with any AT Protocol collection and content type.

Built with [atcute](https://github.com/mary-ext/atcute) and Deno.

## Quick Start

```bash
# Run directly from JSR
deno run -A jsr:@fry69/putrecord init

# Configure your credentials
cp .env.example .env
# Edit .env with your PDS credentials

# Upload a file
deno run -A jsr:@fry69/putrecord
```

## Installation

### CLI Tool

```bash
# Run directly
deno run -A jsr:@fry69/putrecord [OPTIONS]

# Available commands
deno run -A jsr:@fry69/putrecord init    # Initialize project files
deno run -A jsr:@fry69/putrecord --help  # Show help
```

### Library

```typescript
import {
  buildRecord,
  createRecord,
  loadConfig,
  readFile,
  uploadRecord,
} from "jsr:@fry69/putrecord/lib";

const config = loadConfig();
const content = await readFile(config.filePath);
const record = buildRecord(config.collection, content);
const result = await createRecord(client, config, record);
```

See [Library API documentation](docs/LIBRARY.md) for details.

## Configuration

Create a `.env` file with your credentials:

```bash
PDS_URL=https://bsky.social
IDENTIFIER=alice.bsky.social
APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
COLLECTION=com.example.note
FILE_PATH=./content/note.txt
# RKEY=             # Optional: omit for create, set for update
```

**Environment Variables:**

- `PDS_URL` - PDS endpoint
- `IDENTIFIER` - Your handle or DID
- `APP_PASSWORD` - App password (not main password!)
- `COLLECTION` - Collection in NSID format
- `FILE_PATH` - Path to file to upload
- `RKEY` - Optional: omit to create new record, set to update existing

## Two Modes

### Create Mode (First Upload)

Omit `RKEY` to create a new record. The PDS generates a timestamp-based RKEY
that you can save for updates.

```bash
# First upload - no RKEY in .env
deno run -A jsr:@fry69/putrecord

# Output shows:
# ⚠️  Save this RKEY for future updates: 3l4k2j3h4k5l
#    Add to your .env file: RKEY=3l4k2j3h4k5l
```

### Update Mode (Subsequent Uploads)

Include `RKEY` in your `.env` to update the existing record.

```bash
# Add RKEY to .env
echo "RKEY=3l4k2j3h4k5l" >> .env

# Updates will now modify the existing record
deno run -A jsr:@fry69/putrecord
```

## Content Handling

Works with any content type:

- **JSON with `$type`**: Used as-is for custom lexicon schemas
- **WhiteWind blog entries** (`com.whtwnd.blog.entry`): Automatically creates
  proper blog records with `visibility: "public"` and extracts title from
  markdown
- **Plain text**: Wrapped in a generic record structure with `$type`, `content`,
  and `createdAt`

**WhiteWind Blog Example:**

```markdown
# My Blog Post

This is my blog content in markdown format.
```

Automatically becomes:

```json
{
  "$type": "com.whtwnd.blog.entry",
  "content": "# My Blog Post\n\nThis is my blog content...",
  "title": "My Blog Post",
  "visibility": "public",
  "createdAt": "2025-10-08T..."
}
```

**Custom JSON Example:**

```json
{
  "$type": "com.example.myapp.post",
  "title": "My Post",
  "content": "Post content here",
  "tags": ["tag1", "tag2"]
}
```

## CLI Options

- `-q, --quiet` - Suppress non-error output
- `-f, --force` - Overwrite existing files (init command)
- `-h, --help` - Show help
- `-v, --version` - Show version

## GitHub Actions Automation

The `init` command sets up everything you need:

```bash
# Initialize GitHub Actions workflow
deno run -A jsr:@fry69/putrecord init
```

This creates:

- `.github/workflows/putrecord.yaml` - Automated upload workflow
- `.env.example` - Configuration template

**Setup secrets:**

```bash
# Using GitHub CLI
gh secret set -f .env

# Or manually: Settings → Secrets and variables → Actions
```

See [GitHub Actions Guide](docs/GITHUB_ACTIONS.md) for detailed setup.

## Example Repository

See **[putrecord-test](https://github.com/fry69/putrecord-test)** - A working
example that demonstrates automated uploads using GitHub Actions. The repository
automatically updates its README on every push and uploads it to a PDS.

## Documentation

- **[Library API](docs/LIBRARY.md)** - Programmatic usage and function reference
- **[GitHub Actions](docs/GITHUB_ACTIONS.md)** - CI/CD automation setup
- **[Development](docs/DEVELOPMENT.md)** - Testing and contributing

## Use Cases

- **Content Publishing**: Automate blog post or note uploads
- **Data Sync**: Keep PDS records in sync with repository files
- **CI/CD Integration**: Deploy content changes automatically
- **Custom Applications**: Build tools using any AT Protocol collection

## License

MIT
