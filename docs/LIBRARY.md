# Library API

The `@fry69/putrecord` library provides pure functions for uploading AT Protocol
records. All functions are **quiet by default** (no console output), making them
ideal for programmatic usage, automation, and custom workflows.

## Installation

```typescript
import {
  buildRecord,
  type Config,
  createRecord,
  loadConfig,
  readFile,
  uploadRecord,
} from "jsr:@fry69/putrecord/lib";
```

Or in `deno.json`:

```json
{
  "imports": {
    "@fry69/putrecord/lib": "jsr:@fry69/putrecord@^0.1.0/lib"
  }
}
```

## Type Definitions

### Config

```typescript
interface Config {
  pdsUrl: string; // PDS endpoint URL
  identifier: string; // Handle or DID
  password: string; // App password
  collection: string; // NSID format collection
  rkey?: string; // Optional: record key for updates
  filePath: string; // Path to file to upload
}
```

## Functions

### `loadConfig(): Config`

Loads and validates configuration from environment variables.

**Environment Variables:**

- `PDS_URL` (required) - PDS endpoint
- `IDENTIFIER` (required) - User handle or DID
- `APP_PASSWORD` (required) - App password
- `COLLECTION` (required) - Collection in NSID format
- `FILE_PATH` (required) - Path to file
- `RKEY` (optional) - Record key for updates

**Returns:** `Config` object

**Throws:** Error if required environment variables are missing

**Example:**

```typescript
import { loadConfig } from "jsr:@fry69/putrecord/lib";

// Set environment variables
Deno.env.set("PDS_URL", "https://bsky.social");
Deno.env.set("IDENTIFIER", "alice.bsky.social");
Deno.env.set("APP_PASSWORD", "xxxx-xxxx-xxxx-xxxx");
Deno.env.set("COLLECTION", "com.example.note");
Deno.env.set("FILE_PATH", "./content/note.txt");

const config = loadConfig();
console.log(config.collection); // "com.example.note"
```

---

### `readFile(path: string): Promise<string>`

Reads file content as text.

**Parameters:**

- `path` - Absolute or relative file path

**Returns:** Promise resolving to file content as string

**Throws:** Error if file cannot be read

**Example:**

```typescript
import { readFile } from "jsr:@fry69/putrecord/lib";

const content = await readFile("./content/note.txt");
console.log(`File size: ${content.length} characters`);
```

---

### `buildRecord(collection: string, content: string, existingRecord?: Record<string, unknown>, forceFields?: boolean): Record<string, unknown>`

Builds an AT Protocol record from content. Intelligently handles different
content types.

**Parameters:**

- `collection` - Collection NSID (e.g., `"com.example.note"`)
- `content` - File content (text or JSON)
- `existingRecord` - Optional: Existing record data for updates
- `forceFields` - Optional: If true, always extract/set fields even if they
  exist (default: false)

**Returns:** Record object ready for AT Protocol

**Behavior:**

- If content is valid JSON with a `$type` field: Uses the parsed JSON as-is
- For WhiteWind blog entries (`com.whtwnd.blog.entry`): Creates proper blog
  record with required `visibility` field and extracts title from markdown
  - **When updating** (existingRecord provided): Preserves existing `title` and
    `visibility` unless `forceFields` is true
  - **When creating** (no existingRecord): Extracts title from markdown and sets
    `visibility: "public"`
- Otherwise: Wraps content in a structure with `$type`, `content`, and
  `createdAt` fields

**Examples:**

**Plain Text:**

```typescript
import { buildRecord } from "jsr:@fry69/putrecord/lib";

const record = buildRecord("com.example.note", "My note content");
// Returns:
// {
//   $type: "com.example.note",
//   content: "My note content",
//   createdAt: "2025-10-08T10:30:00.000Z"
// }
```

**WhiteWind Blog Entry (Special Handling):**

```typescript
const markdown = "# My Blog Post\n\nThis is the content.";
const record = buildRecord("com.whtwnd.blog.entry", markdown);
// Returns:
// {
//   $type: "com.whtwnd.blog.entry",
//   content: "# My Blog Post\n\nThis is the content.",
//   title: "My Blog Post",
//   visibility: "public",
//   createdAt: "2025-10-08T10:30:00.000Z"
// }
```

**WhiteWind Update (Preserving Existing Fields):**

```typescript
const markdown = "# New Title\n\nUpdated content.";
const existingRecord = {
  $type: "com.whtwnd.blog.entry",
  content: "# Old Title\n\nOld content.",
  title: "Custom Title That I Set",
  visibility: "author",
  createdAt: "2025-01-01T00:00:00.000Z",
};

// Preserves existing title and visibility by default
const record = buildRecord("com.whtwnd.blog.entry", markdown, existingRecord);
// Returns:
// {
//   $type: "com.whtwnd.blog.entry",
//   content: "# New Title\n\nUpdated content.",
//   title: "Custom Title That I Set",  // ← Preserved!
//   visibility: "author",               // ← Preserved!
//   createdAt: "2025-10-08T..."
// }

// Force extraction of title from markdown
const recordForced = buildRecord(
  "com.whtwnd.blog.entry",
  markdown,
  existingRecord,
  true
);
// Returns:
// {
//   $type: "com.whtwnd.blog.entry",
//   content: "# New Title\n\nUpdated content.",
//   title: "New Title",      // ← Extracted from markdown!
//   visibility: "public",    // ← Reset to default!
//   createdAt: "2025-10-08T..."
// }
```

**Custom JSON Schema:**

```typescript
const jsonContent = JSON.stringify({
  $type: "com.example.post",
  title: "My Post",
  body: "Content here",
  tags: ["tech", "atproto"],
});

const record = buildRecord("com.example.post", jsonContent);
// Returns the parsed JSON object as-is:
// {
//   $type: "com.example.post",
//   title: "My Post",
//   body: "Content here",
//   tags: ["tech", "atproto"]
// }
```

---

### `getRecord(client: Client, config: Config): Promise<Record<string, unknown> | null>`

Fetches an existing record from the PDS.

**Parameters:**

- `client` - Authenticated AT Protocol client
- `config` - Configuration object (must include `rkey`)

**Returns:** Promise resolving to the existing record data, or `null` if not
found or RKEY not provided

**Throws:** Does not throw - returns `null` on error

**Example:**

```typescript
import { Client, CredentialManager } from "@atcute/client";
import { getRecord, loadConfig } from "jsr:@fry69/putrecord/lib";

// Setup (config must include RKEY)
Deno.env.set("RKEY", "3l4k2j3h4k5l");
const config = loadConfig();

const manager = new CredentialManager({ service: config.pdsUrl });
const client = new Client({ handler: manager });
await manager.login({
  identifier: config.identifier,
  password: config.password,
});

// Fetch existing record
const existingRecord = await getRecord(client, config);
if (existingRecord) {
  console.log("Existing title:", existingRecord.title);
  console.log("Existing visibility:", existingRecord.visibility);
}
```

---

### `createRecord(client: Client, config: Config, record: Record<string, unknown>): Promise<{ uri: string; cid: string; rkey: string }>`

Creates a new record in the PDS with an auto-generated RKEY.

Uses `com.atproto.repo.createRecord` to create a new record. The PDS
automatically generates a timestamp-based RKEY (TID), which is returned for
future updates.

**Parameters:**

- `client` - Authenticated AT Protocol client (from `@atcute/client`)
- `config` - Configuration object
- `record` - Record data to upload

**Returns:** Promise resolving to object with:

- `uri` - AT URI of the created record
- `cid` - Content identifier
- `rkey` - Generated record key (save this for updates!)

**Throws:** Error if record creation fails

**Example:**

```typescript
import { Client, CredentialManager } from "@atcute/client";
import {
  buildRecord,
  createRecord,
  loadConfig,
  readFile,
} from "jsr:@fry69/putrecord/lib";

// Setup
const config = loadConfig();
const manager = new CredentialManager({ service: config.pdsUrl });
const client = new Client({ handler: manager });

await manager.login({
  identifier: config.identifier,
  password: config.password,
});

// Create record
const content = await readFile(config.filePath);
const record = buildRecord(config.collection, content);
const result = await createRecord(client, config, record);

console.log(`Created: ${result.uri}`);
console.log(`RKEY: ${result.rkey}`);
console.log(`CID: ${result.cid}`);

// Save the RKEY for future updates!
// You might want to: Deno.env.set("RKEY", result.rkey);
```

---

### `uploadRecord(client: Client, config: Config, record: Record<string, unknown>): Promise<{ uri: string; cid: string }>`

Updates an existing record in the PDS.

Uses `com.atproto.repo.putRecord` to overwrite an existing record at the
specified RKEY. The RKEY must be provided in the config.

**Parameters:**

- `client` - Authenticated AT Protocol client
- `config` - Configuration object (must include `rkey`)
- `record` - Updated record data to upload

**Returns:** Promise resolving to object with:

- `uri` - AT URI of the updated record
- `cid` - New content identifier

**Throws:**

- Error if `RKEY` is not provided in config
- Error if record update fails

**Example:**

```typescript
import { Client, CredentialManager } from "@atcute/client";
import {
  buildRecord,
  loadConfig,
  readFile,
  uploadRecord,
} from "jsr:@fry69/putrecord/lib";

// Setup (config must include RKEY)
Deno.env.set("RKEY", "3l4k2j3h4k5l"); // From previous create
const config = loadConfig();

const manager = new CredentialManager({ service: config.pdsUrl });
const client = new Client({ handler: manager });

await manager.login({
  identifier: config.identifier,
  password: config.password,
});

// Update record
const content = await readFile(config.filePath);
const record = buildRecord(config.collection, content);
const result = await uploadRecord(client, config, record);

console.log(`Updated: ${result.uri}`);
console.log(`New CID: ${result.cid}`);
```

## Complete Example

Here's a complete example showing create and update workflows:

```typescript
import { Client, CredentialManager } from "@atcute/client";
import {
  buildRecord,
  createRecord,
  loadConfig,
  readFile,
  uploadRecord,
} from "jsr:@fry69/putrecord/lib";

async function main() {
  // Load configuration
  const config = loadConfig();

  // Authenticate
  const manager = new CredentialManager({ service: config.pdsUrl });
  const client = new Client({ handler: manager });

  await manager.login({
    identifier: config.identifier,
    password: config.password,
  });

  // Read and build record
  const content = await readFile(config.filePath);
  const record = buildRecord(config.collection, content);

  // Create or update based on RKEY presence
  if (config.rkey) {
    // Update existing record
    const result = await uploadRecord(client, config, record);
    console.log(`✓ Updated: ${result.uri}`);
  } else {
    // Create new record
    const result = await createRecord(client, config, record);
    console.log(`✓ Created: ${result.uri}`);
    console.log(`Save this RKEY: ${result.rkey}`);
  }
}

main();
```

## Error Handling

All functions may throw errors. Wrap calls in try-catch blocks:

```typescript
try {
  const config = loadConfig();
  const content = await readFile(config.filePath);
  const record = buildRecord(config.collection, content);
  // ... proceed with upload
} catch (error) {
  console.error(`Error: ${error.message}`);
  // Handle error appropriately
}
```

## Integration with atcute

The library uses [@atcute](https://github.com/mary-ext/atcute) for AT Protocol
operations. You'll need to:

1. Create a `CredentialManager` with your PDS URL
2. Create a `Client` with the credential manager
3. Login with your credentials
4. Pass the authenticated client to `createRecord` or `uploadRecord`

See the examples above for the complete authentication flow.

## CLI vs Library

| Feature            | CLI                                 | Library                         |
| ------------------ | ----------------------------------- | ------------------------------- |
| **Entry Point**    | `jsr:@fry69/putrecord`              | `jsr:@fry69/putrecord/lib`      |
| **Console Output** | Verbose (use `--quiet` to suppress) | Silent by default               |
| **Use Case**       | Interactive, manual uploads         | Automation, programmatic usage  |
| **Configuration**  | Environment variables only          | Flexible (can construct Config) |
| **Error Handling** | Exits with code 1 on error          | Throws errors to catch          |

Choose the library when:

- Building custom tools or workflows
- Need fine-grained control
- Want to integrate with other code
- Need to handle errors programmatically
- Want silent operation by default
