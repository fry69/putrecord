# atproto-push

Upload markdown files as AT Protocol records to a PDS. Built with
[atcute](https://github.com/mary-ext/atcute) and Deno.

## Configuration

Environment variables:

- `PDS_URL` - PDS endpoint (e.g., `https://bsky.social`)
- `IDENTIFIER` - Handle or DID (e.g., `alice.bsky.social`)
- `APP_PASSWORD` - App password (not main account password)
- `COLLECTION` - Lexicon collection (e.g., `com.whtwnd.blog.entry`)
- `RKEY` - Record key
- `MARKDOWN_PATH` - Path to markdown file

## Usage

### Local

```bash
cp .env.example .env
# Edit .env with credentials
deno task upload
```

### GitHub Actions

Upload secrets to repository:

```bash
# Using GitHub CLI
gh secret set -f .env

# Or using deno task
deno task secrets
```

Then push changes to trigger upload.

## Example: WhiteWind Blog

Create `.env`:

```bash
PDS_URL=https://bsky.social
IDENTIFIER=alice.bsky.social
APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
COLLECTION=com.whtwnd.blog.entry
RKEY=my-first-post
MARKDOWN_PATH=./posts/blog-post.md
```

Create `posts/blog-post.md`:

```markdown
# My First Post

Content here.
```

Upload:

```bash
deno task upload
```

## Testing

```bash
deno task test
```

Unit tests cover basic functionality and error handling. They primarily serve as
documentation of expected behavior. The upload functionality (`uploadRecord`)
requires manual testing or network mocking.

## API

### `loadConfig(): Config`

Loads and validates environment variables.

### `readMarkdown(path: string): Promise<string>`

Reads markdown file content.

### `createBlogRecord(content: string): Record<string, unknown>`

Creates AT Protocol record with `$type`, `content`, and `createdAt`.

### `uploadRecord(client, config, record): Promise<{ uri, cid }>`

Uploads record via `com.atproto.repo.putRecord`.

## License

MIT
