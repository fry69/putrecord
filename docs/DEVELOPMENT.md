# Development Guide

Information for contributors and maintainers of `@fry69/putrecord`.

## Project Structure

```
putrecord/
├── src/
│   ├── main.ts         # CLI entry point
│   ├── lib.ts          # Library functions
│   └── templates.ts    # Inlined templates for init command
├── tests/
│   ├── lib.test.ts       # Unit tests for library functions
│   ├── init.test.ts      # Unit tests for init command
│   ├── lib.e2e.test.ts   # E2E tests against real PDS (library)
│   ├── main.e2e.test.ts  # E2E tests against real PDS (CLI)
│   └── test_utils.ts     # Cross-platform test utilities
├── docs/                 # Documentation
├── workflow.yaml       # Example workflow (reference)
├── .env.example        # Example config (reference)
└── deno.json          # Project configuration
```

## Development Setup

```bash
# Clone repository
git clone https://github.com/fry69/putrecord.git
cd putrecord

# Install Deno (if not already installed)
curl -fsSL https://deno.land/install.sh | sh

# Run tests
deno task test:unit

# Check code quality
deno task check
```

## Testing

### Unit Tests

Unit tests cover library functions and init command without requiring external
services.

```bash
# Run all unit tests
deno task test:unit

# Run specific test file
deno test -A tests/lib.test.ts
deno test -A tests/init.test.ts
```

**Unit test coverage:**

- `tests/lib.test.ts` (15 tests):

  - Configuration loading from environment variables
  - Record building for text and JSON content
  - WhiteWind blog entry handling
  - Field preservation on updates
  - Force fields override behavior
  - File reading operations

- `tests/init.test.ts` (11 tests):
  - Directory creation (cross-platform)
  - File generation (workflow, .env.example)
  - Force flag behavior
  - Quiet mode output suppression
  - Skip behavior for existing files

**Note on cross-platform testing:**

Tests use the `test_utils.ts` module to ensure cross-platform compatibility,
especially for path handling on Windows vs Unix-like systems. See
[TEST_UTILITIES.md](TEST_UTILITIES.md) for details.

### End-to-End Tests

E2E tests verify actual PDS operations. Requires a real PDS account and
`.env.e2e` configuration.

**Setup:**

```bash
# Create E2E test configuration
cp .env.example .env.e2e

# Edit with test account credentials
# Use a dedicated test account, NOT your main account!
```

**Run E2E tests:**

```bash
deno task test:e2e
```

**E2E test coverage:**

- `tests/lib.e2e.test.ts` (7 tests):

  - Creating new records (without RKEY)
  - Updating existing records (with RKEY)
  - Error handling for invalid operations
  - WhiteWind field preservation (title, visibility)
  - Force fields override behavior

- `tests/main.e2e.test.ts` (3 tests):
  - CLI workflow with field preservation
  - CLI with `--force-fields` flag
  - CLI with `FORCE_FIELDS` environment variable

**Total: 10 E2E tests** validating real-world usage patterns.

See [E2E_TESTING.md](E2E_TESTING.md) for detailed E2E testing documentation.

**Important:** E2E tests automatically clean up created records.

### Run All Tests

```bash
deno task test:all
```

This runs all unit tests and E2E tests (if `.env.e2e` exists).

### Testing Best Practices

1. **Isolation**: All tests use temporary directories (`Deno.makeTempDir()`)
2. **Cleanup**: Test files are automatically removed after each test
3. **No side effects**: Tests don't pollute the working directory
4. **Parallel-safe**: Tests can run concurrently without conflicts

## Code Quality

### Formatting

```bash
# Check formatting
deno fmt --check

# Auto-format code
deno fmt
```

### Linting

```bash
# Run linter
deno lint
```

### Type Checking

```bash
# Check types
deno check src/*.ts tests/*.ts
```

### Complete Check

Run all quality checks:

```bash
deno task check
```

This runs: formatting, linting, type checking, and unit tests.

## Template Maintenance

⚠️ **Critical:** The `init` command uses inlined templates for reliability and
offline support. Templates must be kept in sync!

### Template Locations

1. **Inlined templates** (`src/templates.ts`):

   - `WORKFLOW_TEMPLATE` - GitHub Actions workflow
   - `ENV_EXAMPLE_TEMPLATE` - Environment configuration

2. **Reference files** (repository root):
   - `workflow.yaml` - Workflow example
   - `.env.example` - Environment example

### Updating Templates

When modifying templates, update **BOTH** locations:

1. Update the inlined template in `src/templates.ts`
2. Update the reference file in repository root
3. Verify they match:

   ```bash
   # Workflow should match (ignoring escaped $ vs unescaped)
   diff -w workflow.yaml <(grep -A 50 "WORKFLOW_TEMPLATE" src/templates.ts)

   # .env.example should match exactly
   diff .env.example <(grep -A 20 "ENV_EXAMPLE_TEMPLATE" src/templates.ts)
   ```

### Why Two Copies?

- **Inlined templates**: Used by `init` command - works offline, no external
  dependencies
- **Reference files**: Easy to copy manually, visible in repository, used in
  documentation

### Template Escaping

In `src/templates.ts`, use `\$` to escape dollar signs in template literals:

```typescript
export const WORKFLOW_TEMPLATE = `
  PDS_URL: \${{ secrets.PDS_URL }}
  # ^ Escaped for JavaScript template string
`;
```

The reference files use unescaped `$`:

```yaml
PDS_URL: ${{ secrets.PDS_URL }}
# ^ Normal YAML syntax
```

## Version Management

Versions are specified in two places:

1. **`deno.json`**: Package version for JSR
2. **`src/main.ts`**: `VERSION` constant for CLI `--version` output

**When releasing:**

1. Update version in `deno.json`
2. Update `VERSION` constant in `src/main.ts`
3. Commit with version tag: `git tag v0.1.0`

## Architecture Decisions

### Library/CLI Separation

- **`src/lib.ts`**: Pure functions, no console output, for programmatic use
- **`src/main.ts`**: CLI wrapper with logging, error messages, user interaction

**Benefits:**

- Library can be used in scripts without unwanted output
- CLI provides user-friendly experience
- Clear separation of concerns
- Easy to test library functions independently

### Content-Neutral Design

The code makes no assumptions about content format or collection schema:

- `buildRecord()` intelligently handles JSON vs text
- Works with any AT Protocol collection (NSID format)
- No hardcoded schemas or content types
- Users can use custom lexicons

### Inlined Templates

Templates are embedded in code rather than loaded from files:

**Advantages:**

- Works offline
- No file I/O during init
- Single binary distribution
- No missing file errors
- Reliable across platforms

**Trade-off:**

- Must keep templates in sync manually
- Code review needed for template changes

## Contributing

### Pull Request Process

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/my-feature`
3. **Make changes** and add tests
4. **Run checks**: `deno task check`
5. **Commit**: Use descriptive commit messages
6. **Push** and create a pull request

### Coding Standards

- Follow Deno's style guide (enforced by `deno fmt`)
- Add JSDoc comments for public functions
- Write tests for new features
- Keep functions focused and single-purpose
- Use TypeScript strict mode
- Avoid `any` types

### Test Requirements

- All new features must have unit tests
- Update E2E tests if changing core functionality
- Ensure all tests pass before submitting PR
- Tests must be isolated and parallel-safe

### Documentation

- Update README if changing user-facing features
- Update JSDoc comments for API changes
- Add examples for new functionality
- Update relevant docs in `docs/` directory

## Publishing to JSR

```bash
# Ensure everything is ready
deno task check

# Test locally
deno run -A src/main.ts --help

# Publish (requires JSR account)
deno publish
```

## Debugging

### Enable Verbose Logging

The CLI has a `--quiet` flag. Run without it for verbose output:

```bash
deno run -A jsr:@fry69/putrecord
# Shows: Loading configuration, authentication, upload progress
```

### Test with Local Build

```bash
# Run local version
deno run -A src/main.ts --help

# Test init command
deno run -A src/main.ts init

# Test with local .env
deno run -A src/main.ts
```

### Debug E2E Tests

```bash
# Run single E2E test with console output
deno test --allow-all tests/lib.e2e.test.ts --filter "Create new record"
```

### Common Issues

**Import errors:**

- Check `deno.json` imports are correct
- Verify JSR package versions
- Run `deno cache --reload`

**Test failures:**

- Ensure `.env.e2e` is configured for E2E tests
- Check temp directory cleanup
- Verify test isolation

**Authentication errors:**

- Use app password, not main password
- Check PDS URL format (include `https://`)
- Verify identifier format (handle or DID)

## Code Review Checklist

When reviewing code changes:

- [ ] All tests pass
- [ ] Code follows style guide (`deno fmt` passes)
- [ ] No linting errors (`deno lint` passes)
- [ ] Type checking passes (`deno check` passes)
- [ ] JSDoc comments added/updated
- [ ] Tests added for new features
- [ ] Documentation updated if needed
- [ ] Templates in sync (if modified)
- [ ] No hardcoded credentials or secrets
- [ ] Error messages are helpful
- [ ] Examples work as shown

## Release Checklist

Before releasing a new version:

- [ ] All tests pass (`deno task test:all`)
- [ ] Code quality checks pass (`deno task check`)
- [ ] Version updated in `deno.json`
- [ ] Version updated in `src/main.ts`
- [ ] CHANGELOG updated (if applicable)
- [ ] Documentation reviewed
- [ ] Templates in sync
- [ ] Examples tested
- [ ] Tag created: `git tag v0.x.x`
- [ ] Published to JSR: `deno publish`

## Project Philosophy

### Design Principles

1. **Content-neutral**: No assumptions about use case
2. **User-friendly**: Clear errors, helpful messages
3. **Reliable**: Offline support, proper error handling
4. **Simple**: Do one thing well (upload records)
5. **Flexible**: Works as CLI or library
6. **Testable**: Comprehensive test coverage
7. **Documented**: Clear docs and examples

### Non-Goals

- Complex record querying (use atcute directly)
- Multi-record batch operations
- Schema validation (let PDS handle it)
- Custom authentication flows
- GUI or web interface

## Getting Help

- **Issues**: Open an issue on GitHub
- **Questions**: Start a discussion
- **Security**: See SECURITY.md (if applicable)

## License

MIT - see LICENSE file for details
