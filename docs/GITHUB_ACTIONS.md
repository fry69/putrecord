# GitHub Actions Automation

Automate file uploads to your PDS using GitHub Actions. Every time you push
changes, your content is automatically uploaded.

## Quick Setup

The easiest way to get started:

```bash
# Initialize project files
deno run -A jsr:@fry69/putrecord init

# Configure your credentials
cp .env.example .env
# Edit .env with your PDS credentials
```

This creates:

- `.github/workflows/putrecord.yaml` - GitHub Actions workflow
- `.env.example` - Configuration template

## Setting Up Secrets

Your credentials must be configured as GitHub repository secrets.

### Option 1: Using GitHub CLI (Recommended)

```bash
# Set all secrets from your .env file at once
gh secret set -f .env
```

This automatically reads your `.env` file and creates secrets for all variables.

### Option 2: Manual Setup via Web Interface

1. Go to your repository on GitHub
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add each secret:

| Secret Name    | Value                 | Description           |
| -------------- | --------------------- | --------------------- |
| `PDS_URL`      | `https://bsky.social` | Your PDS endpoint     |
| `IDENTIFIER`   | `alice.bsky.social`   | Your handle or DID    |
| `APP_PASSWORD` | `xxxx-xxxx-xxxx-xxxx` | Your app password     |
| `COLLECTION`   | `com.example.note`    | Collection NSID       |
| `FILE_PATH`    | `./content/note.txt`  | Path to file in repo  |
| `RKEY`         | `3l4k2j3h4k5l`        | Record key (optional) |

**Important:** Use an **app password**, not your main account password! Generate
one in your PDS settings.

## Workflow Configuration

The default workflow (`putrecord.yaml`) runs on:

- Push to `main` branch
- Manual trigger via workflow dispatch

```yaml
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
          PDS_URL: ${{ secrets.PDS_URL }}
          IDENTIFIER: ${{ secrets.IDENTIFIER }}
          APP_PASSWORD: ${{ secrets.APP_PASSWORD }}
          COLLECTION: ${{ secrets.COLLECTION }}
          RKEY: ${{ secrets.RKEY }}
          FILE_PATH: ${{ secrets.FILE_PATH }}
        run: deno run -A jsr:@fry69/putrecord --quiet
```

## Usage Workflows

### First Upload (Create Mode)

For your first upload, omit the `RKEY` secret:

1. **Set secrets** (without RKEY):

   ```bash
   gh secret set PDS_URL --body "https://bsky.social"
   gh secret set IDENTIFIER --body "alice.bsky.social"
   gh secret set APP_PASSWORD --body "xxxx-xxxx-xxxx-xxxx"
   gh secret set COLLECTION --body "com.example.note"
   gh secret set FILE_PATH --body "./content/note.txt"
   ```

2. **Commit your content file**:

   ```bash
   mkdir -p content
   echo "My first note" > content/note.txt
   git add content/note.txt .github/workflows/putrecord.yaml
   git commit -m "Initial upload"
   git push
   ```

3. **Check the workflow run** in the Actions tab. Look for the generated RKEY in
   the logs:

   ```
   ⚠️  Save this RKEY for future updates: 3l4k2j3h4k5l
   ```

4. **Add RKEY secret** for future updates:
   ```bash
   gh secret set RKEY --body "3l4k2j3h4k5l"
   ```

### Subsequent Uploads (Update Mode)

Once `RKEY` is set, all pushes will update the existing record:

```bash
# Edit your content
echo "Updated note content" > content/note.txt

# Commit and push
git add content/note.txt
git commit -m "Update note"
git push

# The workflow automatically updates the record at the same RKEY
```

## Advanced Customization

### Trigger on Specific Paths

Only run when specific files change:

```yaml
on:
  push:
    branches:
      - main
    paths:
      - "content/**"
      - "!content/drafts/**"
```

### Trigger on Schedule

Upload automatically on a schedule:

```yaml
on:
  schedule:
    - cron: "0 0 * * *" # Daily at midnight UTC
  workflow_dispatch:
```

### Multiple Files/Collections

Upload different files to different collections:

```yaml
jobs:
  upload-notes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - name: Upload notes
        env:
          PDS_URL: ${{ secrets.PDS_URL }}
          IDENTIFIER: ${{ secrets.IDENTIFIER }}
          APP_PASSWORD: ${{ secrets.APP_PASSWORD }}
          COLLECTION: com.example.note
          RKEY: ${{ secrets.NOTE_RKEY }}
          FILE_PATH: ./content/note.txt
        run: deno run -A jsr:@fry69/putrecord --quiet

  upload-blog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - name: Upload blog post
        env:
          PDS_URL: ${{ secrets.PDS_URL }}
          IDENTIFIER: ${{ secrets.IDENTIFIER }}
          APP_PASSWORD: ${{ secrets.APP_PASSWORD }}
          COLLECTION: com.example.blog.post
          RKEY: ${{ secrets.BLOG_RKEY }}
          FILE_PATH: ./content/blog.md
        run: deno run -A jsr:@fry69/putrecord --quiet
```

### Build Step Before Upload

Generate content before uploading:

```yaml
jobs:
  build-and-upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - name: Build content
        run: |
          deno run -A build.ts
          # Generates ./dist/output.json

      - name: Upload to PDS
        env:
          PDS_URL: ${{ secrets.PDS_URL }}
          IDENTIFIER: ${{ secrets.IDENTIFIER }}
          APP_PASSWORD: ${{ secrets.APP_PASSWORD }}
          COLLECTION: ${{ secrets.COLLECTION }}
          RKEY: ${{ secrets.RKEY }}
          FILE_PATH: ./dist/output.json
        run: deno run -A jsr:@fry69/putrecord --quiet
```

### Conditional Uploads

Upload only if certain conditions are met:

```yaml
jobs:
  upload:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
# ... upload steps
```

### Error Notifications

Get notified if uploads fail:

```yaml
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - name: Upload to PDS
        id: upload
        env:
          PDS_URL: ${{ secrets.PDS_URL }}
          IDENTIFIER: ${{ secrets.IDENTIFIER }}
          APP_PASSWORD: ${{ secrets.APP_PASSWORD }}
          COLLECTION: ${{ secrets.COLLECTION }}
          RKEY: ${{ secrets.RKEY }}
          FILE_PATH: ${{ secrets.FILE_PATH }}
        run: deno run -A jsr:@fry69/putrecord --quiet

      - name: Notify on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'PDS Upload Failed',
              body: 'The automated PDS upload workflow failed. Check the logs.'
            })
```

## Manual Triggering

You can manually trigger the workflow via the GitHub web interface:

1. Go to **Actions** tab in your repository
2. Select **"Upload to PDS"** workflow
3. Click **"Run workflow"**
4. Choose the branch
5. Click **"Run workflow"**

This is useful for testing or one-off uploads without pushing commits.

## Security Best Practices

### ✅ DO:

- Use **app passwords**, never your main account password
- Store credentials as **repository secrets**
- Use `--quiet` flag to avoid logging sensitive information
- Rotate app passwords periodically
- Limit workflow permissions if possible

### ❌ DON'T:

- Commit `.env` files to your repository
- Use your main account password
- Echo secrets in workflow steps
- Make secrets accessible to pull requests from forks

## Troubleshooting

### Workflow fails with "Missing environment variable"

Check that all required secrets are set:

```bash
# List configured secrets
gh secret list

# Set missing secret
gh secret set SECRET_NAME --body "value"
```

### Authentication fails

- Verify your app password is correct
- Ensure you're using an app password, not your main password
- Check that your identifier (handle or DID) is correct

### File not found error

- Verify `FILE_PATH` points to a file that exists in your repository
- Check that the file is committed and pushed
- Use relative paths from repository root (e.g., `./content/note.txt`)

### RKEY errors

- For **create mode**: Don't set the `RKEY` secret
- For **update mode**: Ensure `RKEY` secret matches the record you want to
  update

### Check workflow logs

1. Go to **Actions** tab
2. Click on the failed workflow run
3. Expand the steps to see detailed logs
4. Look for error messages from putrecord

## Migration from Manual to Automated

If you've been using putrecord manually and want to automate:

1. **Initialize workflow**:

   ```bash
   deno run -A jsr:@fry69/putrecord init
   ```

2. **Set secrets** using your existing `.env`:

   ```bash
   gh secret set -f .env
   ```

3. **Commit workflow**:

   ```bash
   git add .github/workflows/putrecord.yaml
   git commit -m "Add automated PDS upload workflow"
   git push
   ```

4. **Verify** the workflow runs successfully in the Actions tab

Your content will now update automatically on every push!

## Examples

### Blog Post Automation

Automatically publish blog posts from Markdown:

```yaml
name: Publish Blog Post

on:
  push:
    branches:
      - main
    paths:
      - "posts/*.md"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - name: Upload to PDS
        env:
          PDS_URL: ${{ secrets.PDS_URL }}
          IDENTIFIER: ${{ secrets.IDENTIFIER }}
          APP_PASSWORD: ${{ secrets.APP_PASSWORD }}
          COLLECTION: com.example.blog.post
          RKEY: ${{ secrets.RKEY }}
          FILE_PATH: ./posts/latest.md
        run: deno run -A jsr:@fry69/putrecord --quiet
```

### Multi-environment Deployment

Deploy to different PDS instances based on branch:

```yaml
name: Deploy to PDS

on:
  push:
    branches:
      - main
      - staging

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        env:
          PDS_URL: ${{ secrets.PROD_PDS_URL }}
          IDENTIFIER: ${{ secrets.PROD_IDENTIFIER }}
          APP_PASSWORD: ${{ secrets.PROD_APP_PASSWORD }}
          COLLECTION: ${{ secrets.COLLECTION }}
          RKEY: ${{ secrets.PROD_RKEY }}
          FILE_PATH: ${{ secrets.FILE_PATH }}
        run: deno run -A jsr:@fry69/putrecord --quiet

      - name: Deploy to staging
        if: github.ref == 'refs/heads/staging'
        env:
          PDS_URL: ${{ secrets.STAGING_PDS_URL }}
          IDENTIFIER: ${{ secrets.STAGING_IDENTIFIER }}
          APP_PASSWORD: ${{ secrets.STAGING_APP_PASSWORD }}
          COLLECTION: ${{ secrets.COLLECTION }}
          RKEY: ${{ secrets.STAGING_RKEY }}
          FILE_PATH: ${{ secrets.FILE_PATH }}
        run: deno run -A jsr:@fry69/putrecord --quiet
```

## Next Steps

- Customize the workflow for your specific needs
- Set up notifications for successful uploads
- Integrate with other CI/CD steps
- Explore multiple collections and files
- Review [Library API](LIBRARY.md) for advanced usage
