# End-to-End Testing for putrecord

This document describes the end-to-end (E2E) test suite for putrecord, which
tests the complete functionality against a real AT Protocol PDS.

## Overview

The E2E test suite consists of two test files:

1. **`tests/lib.e2e.test.ts`** - Library-level E2E tests (7 tests)
2. **`tests/main.e2e.test.ts`** - CLI-level E2E tests (3 tests)

**Total: 10 E2E tests**

## Running E2E Tests

E2E tests require a `.env.e2e` file with real PDS credentials. If this file is
not present, all E2E tests are automatically skipped.

### Setup

Create a `.env.e2e` file in the project root:

```env
PDS_URL=https://bsky.social
IDENTIFIER=your-handle.bsky.social
APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

**Important:** The `.env.e2e` file is gitignored and should NEVER be committed.

### Running Tests

```bash
# Run all E2E tests
deno task test:e2e

# Run library E2E tests only
deno test --allow-net --allow-env --allow-read --allow-write tests/lib.e2e.test.ts

# Run CLI E2E tests only
deno test --allow-net --allow-env --allow-read --allow-write --allow-run tests/main.e2e.test.ts

# Run all tests (unit + E2E)
deno task test:all
```

## Test Coverage

### Library E2E Tests (`tests/lib.e2e.test.ts`)

These tests validate the core library functions by directly calling the API:

1. **Create new record without RKEY** - Tests creating a new WhiteWind blog post
2. **Update existing record with RKEY** - Tests updating an existing record
3. **uploadRecord should fail without RKEY** - Validates error handling
4. **WhiteWind - Create with default visibility** - Tests default WhiteWind
   field values
5. **WhiteWind - Preserve custom title on update** - Tests field preservation
   for title
6. **WhiteWind - Preserve custom visibility on update** - Tests field
   preservation for visibility
7. **WhiteWind - Force fields override on update** - Tests forceFields parameter
   to override preservation

### CLI E2E Tests (`tests/main.e2e.test.ts`)

These tests validate the complete CLI workflow by running the actual `main.ts`
command:

1. **WhiteWind - Create and preserve custom title on update**

   - Creates a blog post via CLI
   - Manually sets a custom title via API
   - Updates via CLI (default behavior)
   - Verifies custom title is preserved

2. **WhiteWind - Force fields override with --force-fields**

   - Creates a blog post via CLI
   - Sets custom title and visibility via API
   - Updates via CLI with `--force-fields` flag
   - Verifies fields are forced to new extracted/default values

3. **WhiteWind - Force fields via FORCE_FIELDS env var**
   - Creates a blog post via CLI
   - Sets custom title via API
   - Updates via CLI with `FORCE_FIELDS=true` environment variable
   - Verifies title is forced to new extracted value

## What These Tests Validate

### Core Functionality

- ✅ Creating new records in WhiteWind blog collection
- ✅ Updating existing records by RKEY
- ✅ Proper error handling (e.g., update without RKEY)
- ✅ Authentication and API communication

### WhiteWind-Specific Features

- ✅ Default visibility field ("public")
- ✅ Title extraction from markdown H1 heading
- ✅ Field preservation on updates (default behavior)
- ✅ Force fields override via `--force-fields` flag
- ✅ Force fields override via `FORCE_FIELDS` environment variable

### Integration Points

- ✅ Library API (`buildRecord`, `createRecord`, `uploadRecord`, `getRecord`)
- ✅ CLI execution with environment variables
- ✅ CLI flags (`--force-fields`)
- ✅ Real PDS communication (authentication, create, read, update, delete)

## Test Isolation and Cleanup

All E2E tests follow these best practices:

1. **Temporary files**: Each test creates a unique temporary directory for test
   files
2. **Record cleanup**: All created records are deleted after the test completes
3. **Error handling**: Cleanup is performed even if the test fails
4. **Wait periods**: Tests include appropriate delays for record propagation (1
   second)

## Continuous Integration

E2E tests are designed to work in CI/CD pipelines:

- Tests automatically skip if `.env.e2e` is not present
- No manual intervention required
- Can be run in GitHub Actions by adding PDS credentials as secrets

Example GitHub Actions setup:

```yaml
- name: Create .env.e2e for E2E tests
  run: |
    echo "PDS_URL=${{ secrets.PDS_URL }}" > .env.e2e
    echo "IDENTIFIER=${{ secrets.IDENTIFIER }}" >> .env.e2e
    echo "APP_PASSWORD=${{ secrets.APP_PASSWORD }}" >> .env.e2e

- name: Run E2E tests
  run: deno task test:e2e
```

## Development Workflow

When developing new features:

1. Write unit tests first (`tests/lib.test.ts`)
2. Implement the feature
3. Add E2E tests to validate end-to-end functionality
4. Run `deno task check` to verify all tests pass
5. Run `deno task test:e2e` to verify E2E tests (if `.env.e2e` exists)

## Debugging E2E Tests

E2E tests provide detailed console output:

```
✓ E2E configuration found, running integration tests...

E2E: WhiteWind - Preserve custom title on update ...
  Created WhiteWind record with custom title: 3m2oxilahg52x
  Updated record while preserving custom title
  ✓ Custom title preserved after update
  Cleaned up record: 3m2oxilahg52x
```

If a test fails:

1. Check the console output for the specific RKEY
2. Verify the record on the PDS (if not cleaned up)
3. Check authentication credentials in `.env.e2e`
4. Ensure the PDS is accessible and responding

## Security Notes

⚠️ **Important Security Considerations:**

1. Never commit `.env.e2e` to version control
2. Use app passwords, not main account passwords
3. Consider using a test account dedicated to E2E testing
4. Be aware that E2E tests create and delete real records on the PDS
5. Test records are visible to others during the brief time they exist

## Test Maintenance

When updating the codebase:

- Update E2E tests if CLI output messages change
- Add new E2E tests for new WhiteWind-specific features
- Keep E2E tests focused on real-world usage scenarios
- Ensure cleanup logic works even when tests fail
