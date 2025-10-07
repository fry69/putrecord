# Quick Start Guide

Get up and running in 5 minutes.

## Prerequisites

- [Deno](https://deno.land/) installed
- A Bluesky/AT Protocol account
- An app password (not your main password!)

## 1. Clone & Setup

```bash
git clone <your-repo-url>
cd atproto-push
cp .env.example .env
```

## 2. Get Your Credentials

### Create an App Password

1. Go to Bluesky Settings → App Passwords
2. Click "Add App Password"
3. Name it (e.g., "blog-uploader")
4. Copy the generated password

### Find Your Information

- **PDS URL**: Usually `https://bsky.social` (unless using custom PDS)
- **Identifier**: Your handle (e.g., `alice.bsky.social`) or DID
- **Collection**: For WhiteWind blogs, use `com.whtwnd.blog.entry`
- **Rkey**: Choose a unique key for your post (e.g., `my-first-post`)

## 3. Configure

Edit `.env`:

```bash
PDS_URL=https://bsky.social
IDENTIFIER=your-handle.bsky.social
APP_PASSWORD=paste-your-app-password-here
COLLECTION=com.whtwnd.blog.entry
RKEY=my-first-post
MARKDOWN_PATH=./posts/blog-post.md
```

## 4. Create Content

Create `posts/blog-post.md`:

```markdown
# My First Blog Post

Hello, AT Protocol!

This is my first post using atproto-push.
```

## 5. Test

```bash
# Run tests to verify setup
deno task test

# Check code quality
deno task check
```

## 6. Upload

```bash
deno task upload
```

You should see:

```
Loading configuration...
Reading file: ./posts/blog-post.md
✓ File read (67 characters)
Authenticating as: your-handle.bsky.social
✓ Authentication successful
Creating blog entry record...
Uploading to com.whtwnd.blog.entry/my-first-post...
✓ Record uploaded successfully
  URI: at://did:plc:xxx/com.whtwnd.blog.entry/my-first-post
  CID: bafyreiabc123...

✓ Upload complete!
```

## 7. Verify

- For WhiteWind: Visit
  `https://whtwnd.com/your-handle.bsky.social/entries/my-first-post`
- Check your AT-URI in any AT Protocol viewer

## Common Issues

### "Missing required environment variable"

- Check all variables in `.env` are set
- No spaces around `=` signs
- No quotes needed for values

### "Authentication failed"

- Verify `IDENTIFIER` matches your account
- Ensure you're using an **app password**, not your main password
- Check `PDS_URL` is correct

### "File not found"

- Verify `MARKDOWN_PATH` is correct
- Path is relative to where you run the command
- Create the file if it doesn't exist

## Next Steps

### Set Up GitHub Actions

1. Go to your GitHub repo → Settings → Secrets
2. Add these secrets:

   - `PDS_URL`
   - `IDENTIFIER`
   - `APP_PASSWORD`
   - `COLLECTION`
   - `RKEY`
   - `MARKDOWN_PATH`

3. Push changes to trigger upload:

```bash
git add posts/blog-post.md
git commit -m "Add blog post"
git push
```

### Multiple Posts

For multiple posts, either:

1. Change `RKEY` and `MARKDOWN_PATH` for each upload
2. Create multiple workflow files
3. Use a shell script to loop through files

Example shell script:

```bash
#!/bin/bash
for file in posts/*.md; do
  export MARKDOWN_PATH="$file"
  export RKEY=$(basename "$file" .md)
  deno task upload
done
```

## Learn More

- [README.md](./README.md) - Full documentation
- [MIGRATION.md](./MIGRATION.md) - Upgrading from v1
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Technical details

## Get Help

- Check [Troubleshooting](./README.md#troubleshooting) in README
- Open an issue on GitHub
- Review AT Protocol docs: https://docs.bsky.app/

## Security Reminder

⚠️ **Never commit `.env` to version control!**

The `.gitignore` file protects you, but always double-check:

```bash
git status  # Should not show .env
```
