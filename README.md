# atproto-push

A minimal script to upload markdown files as records to a PDS (Personal Data
Server) via the AT Protocol. Designed for simplicity and focused on the core use
case: uploading a single markdown document to a specific record key.

## Features

- ✨ **Minimal Core**: No unnecessary abstractions or state management
- 🔐 **Simple Authentication**: Uses app passwords via atcute's
  CredentialManager
- 📝 **Single File Upload**: Focused on one markdown file → one record
- 🧪 **Well Tested**: Unit and integration tests included
- 🚀 **GitHub Actions Ready**: Automated uploads on push

## Design Decisions

### Why Minimal?

The previous implementation was overengineered for the core use case. This
version strips away:

- ❌ State management (state.json tracking multiple files)
- ❌ Directory scanning and batch processing
- ❌ Footer injection and content comparison
- ❌ Complex error recovery

Instead, it focuses on:

- ✅ Single file upload to a specific record key
- ✅ Environment-based configuration
- ✅ Clear, testable functions
- ✅ Explicit error handling

### Library Choice: atcute

We use `@atcute/client` instead of `@atproto/api` because:

1. **Smaller bundle size** (~2.4 kB vs larger)
2. **Modern design** with explicit error handling
3. **Type-safe** without runtime validation overhead
4. **Active maintenance** with good documentation

### Configuration

All configuration is via environment variables - no config files needed:

- `PDS_URL`: The PDS endpoint (e.g., `https://bsky.social`)
- `IDENTIFIER`: Your handle or DID (e.g., `alice.bsky.social`)
- `APP_PASSWORD`: App-specific password from your account settings
- `COLLECTION`: The lexicon collection (e.g., `com.whtwnd.blog.entry`)
- `RKEY`: The record key where content will be stored
- `MARKDOWN_PATH`: Path to the markdown file to upload

## Usage

### Local Development

1. **Install Deno** (if not already installed):

   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   ```

2. **Clone and configure**:

   ```bash
   git clone <repository-url>
   cd atproto-push
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run the script**:
   ```bash
   deno task upload
   ```

### GitHub Actions

The workflow automatically uploads on changes to markdown files in `posts/`:

1. **Configure secrets** in your GitHub repository:

   - `PDS_URL`
   - `IDENTIFIER`
   - `APP_PASSWORD`
   - `COLLECTION`
   - `RKEY`
   - `MARKDOWN_PATH`

2. **Push changes** to trigger upload:
   ```bash
   git add posts/blog-post.md
   git commit -m "Update blog post"
   git push
   ```

## Example: WhiteWind Blog

WhiteWind is a blogging platform built on AT Protocol. Here's how to upload a
blog post:

### 1. Create an App Password

1. Go to your Bluesky settings
2. Navigate to "App Passwords"
3. Create a new app password (e.g., "blog-uploader")
4. Save it securely

### 2. Configure Environment

Create a `.env` file:

```bash
PDS_URL=https://bsky.social
IDENTIFIER=your-handle.bsky.social
APP_PASSWORD=your-app-password-here
COLLECTION=com.whtwnd.blog.entry
RKEY=my-first-post
MARKDOWN_PATH=./posts/blog-post.md
```

### 3. Create Your Markdown

Create `posts/blog-post.md`:

```markdown
# My First Blog Post

This is my first post on WhiteWind using atproto-push!

## Why AT Protocol?

AT Protocol enables decentralized social applications...
```

### 4. Upload

```bash
deno task upload
```

Output:

```
Loading configuration...
Reading file: ./posts/blog-post.md
✓ File read (156 characters)
Authenticating as: your-handle.bsky.social
✓ Authentication successful
Creating blog entry record...
Uploading to com.whtwnd.blog.entry/my-first-post...
✓ Record uploaded successfully
  URI: at://did:plc:xxx/com.whtwnd.blog.entry/my-first-post
  CID: bafyreiabc123...

✓ Upload complete!
```

## Testing

### Unit Tests

Test individual functions in isolation:

```bash
deno task test:unit
```

Tests cover:

- Configuration loading and validation
- Markdown file reading
- Record creation
- Error handling

### Integration Tests

Test the complete workflow:

```bash
deno task test:integration
```

Tests cover:

- Full data transformation pipeline
- Environment configuration
- Workflow structure validation

### All Tests

Run all tests:

```bash
deno task test
```

## Architecture

The script is organized into focused, testable functions:

```
loadConfig()          → Load and validate environment variables
  ↓
readMarkdown(path)    → Read markdown file content
  ↓
createBlogRecord(content) → Create AT Protocol record
  ↓
uploadRecord(client, config, record) → Upload to PDS
```

Each function:

- Has a single responsibility
- Is independently testable
- Has clear input/output types
- Handles errors explicitly

## API Reference

### `loadConfig(): Config`

Loads configuration from environment variables. Throws if any required variable
is missing.

**Returns:** Configuration object with all required fields

**Throws:** `Error` if required environment variables are missing

### `readMarkdown(path: string): Promise<string>`

Reads and returns the content of a markdown file.

**Parameters:**

- `path`: Path to the markdown file

**Returns:** File content as string

**Throws:** `Error` if file cannot be read

### `createBlogRecord(content: string): Record<string, unknown>`

Creates a WhiteWind blog entry record from markdown content.

**Parameters:**

- `content`: Markdown content

**Returns:** Record object with `$type`, `content`, and `createdAt` fields

### `uploadRecord(client, config, record): Promise<{ uri: string; cid: string }>`

Uploads a record to the PDS using putRecord.

**Parameters:**

- `client`: Authenticated atcute Client instance
- `config`: Configuration object
- `record`: Record object to upload

**Returns:** Object with URI and CID of uploaded record

**Throws:** `Error` if upload fails

## Troubleshooting

### Authentication Failed

- Verify your `IDENTIFIER` is correct (handle or DID)
- Ensure `APP_PASSWORD` is an app password, not your main password
- Check that `PDS_URL` is correct for your account

### Record Upload Failed

- Verify `COLLECTION` matches the lexicon you're using
- Ensure `RKEY` is a valid record key (alphanumeric, no spaces)
- Check that your account has permission to write to this collection

### File Not Found

- Verify `MARKDOWN_PATH` is correct relative to where you run the script
- Use absolute paths if relative paths aren't working

## Security Notes

- **Never commit `.env` files** - Add to `.gitignore`
- **Use app passwords**, not your main account password
- **Rotate credentials** if they're exposed
- **Use GitHub Secrets** for CI/CD, never hardcode credentials

## Future Improvements

Potential enhancements while keeping the minimal philosophy:

- [ ] Content validation against lexicon schemas
- [ ] Dry-run mode for testing without uploading
- [ ] Support for multiple collections (via CLI args)
- [ ] Content hashing to detect changes
- [ ] Automatic rkey generation from title

## License

MIT

## Contributing

Contributions welcome! Please:

1. Keep the minimal philosophy
2. Add tests for new functionality
3. Update documentation
4. Follow existing code style

## Resources

- [AT Protocol Documentation](https://docs.bsky.app/)
- [atcute Library](https://github.com/mary-ext/atcute)
- [WhiteWind Blog Platform](https://whtwnd.com/)
- [Deno Documentation](https://deno.land/manual)
