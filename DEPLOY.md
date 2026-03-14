# Deployment to Docker Hub

This project uses **automated semantic versioning** to automatically increment versions, create releases, and deploy Docker images to Docker Hub based on commit messages.

## Automatic Versioning

This project uses **Conventional Commits** to automatically determine version bumps:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types and Version Bumps

| Type        | Version | Example                                 |
| ----------- | ------- | --------------------------------------- |
| `feat:`     | MINOR   | `feat: add yearly nutrient summary`     |
| `fix:`      | PATCH   | `fix: correct calculation logic`        |
| `perf:`     | PATCH   | `perf: optimize database queries`       |
| `refactor:` | PATCH   | `refactor: simplify API handlers`       |
| `docs:`     | No tag  | `docs: update README`                   |
| `style:`    | No tag  | `style: format code`                    |
| `test:`     | No tag  | `test: add unit tests`                  |
| BREAKING    | MAJOR   | `feat: rewrite API\n\nBREAKING CHANGE:` |

### Examples

**Patch version (v1.0.1)**

```
git commit -m "fix: correct nutrient calculation rounding"
```

**Minor version (v1.1.0)**

```
git commit -m "feat: add export work log to CSV"
```

**Major version (v2.0.0)**

```
git commit -m "feat: new database schema

BREAKING CHANGE: The database schema has been completely redesigned"
```

## Workflow Details

### Release Workflow (`release.yml`)

The release workflow automatically:

1. **Analyzes commit messages** using Conventional Commits parser
2. **Determines version bump** (major, minor, or patch)
3. **Updates package.json** versions in both backend and frontend
4. **Creates CHANGELOG.md** with formatted release notes
5. **Commits and tags** the release with the new version
6. **Creates GitHub Release** with formatted release notes
7. **Triggers Docker build** using the new version number
8. **Pushes Docker images** to Docker Hub with:
   - `latest` tag
   - Version tag (e.g., `v1.2.3`)

### Pull Request Workflow (`docker-publish.yml`)

- ✅ Test builds Docker images on every pull request
- ✅ Verifies Dockerfile works before merging
- ✅ Uses GitHub Actions cache for fast builds
- ℹ️ Does not push to Docker Hub

## Image Tags

Images are tagged with:

| Tag      | When                      | Example                        |
| -------- | ------------------------- | ------------------------------ |
| `latest` | When a release is created | `username/lawncare-app:latest` |
| `v1.2.3` | When a release is created | `username/lawncare-app:v1.2.3` |

## Using Images on Unraid

Once images are pushed to Docker Hub, you can pull them on Unraid:

```bash
docker pull yourusername/lawncare-app:latest
docker pull yourusername/lawncare-collector:latest
```

Or use a specific version:

```bash
docker pull yourusername/lawncare-app:v1.2.3
docker pull yourusername/lawncare-collector:v1.2.3
```

Then update your `docker-compose.yml`:

```yaml
services:
  app:
    image: yourusername/lawncare-app:latest
    # or: yourusername/lawncare-app:v1.2.3
    # ... rest of config

  collector:
    image: yourusername/lawncare-collector:latest
    # ... rest of config
```

### Important: Data Directory Permissions

**Containers run as non-root user (UID 10001) for security.**

Before starting the containers on Unraid, ensure your data directory is accessible:

```bash
# Ensure the directory exists and is writable
mkdir -p /mnt/user/lawncare-data
chmod 755 /mnt/user/lawncare-data

# Check permissions (should show drwxr-xr-x or similar)
ls -ld /mnt/user/lawncare-data
```

If you get permission errors, the directory may have restrictive permissions set by Unraid. Use the commands above to ensure the non-root container user (10001) can access it.

## Viewing Releases

### GitHub Releases

- Go to your repository's **Releases** page
- Each release shows:
  - Version number (e.g., v1.2.3)
  - Formatted changelog
  - Links to pull requests and commits
  - Release date and author

### Docker Hub

Check your Docker Hub repository to see:

- Available image tags
- Build dates
- Image sizes
- Available architectures

## Troubleshooting

### Release workflow didn't trigger

**Common cause**: Commit message doesn't follow Conventional Commits format

**Fix**: Ensure commit messages start with `feat:`, `fix:`, `perf:`, or `refactor:`

```bash
# Good ✅
git commit -m "feat: add new feature"

# Bad ❌
git commit -m "added new feature"
git commit -m "update: some changes"
```

### Docker images not appearing on Docker Hub

- Check the **Releases** page - was a release created?
- If no release: commit message may not follow Conventional Commits format
- Check GitHub **Actions** tab for workflow errors
- Verify `DOCKERHUB_TOKEN` is valid

### Can't push commits in release workflow

This is normal and expected - semantic-release automatically handles commits and tags.

## Release Notes Format

Automatic release notes are generated with sections:

```
✨ Features
- feat: add yearly nutrient summary

🐛 Bug Fixes
- fix: correct calculation logic

⚡ Performance
- perf: optimize database queries

📚 Documentation
- docs: update README

🔧 Chores
- chore: update dependencies
```

## Manual Workflow (If Needed)

If automatic versioning causes issues, you can disable automation by not merging commits with conventional commit messages. Each commit without a recognized type won't trigger a release, and you can create releases manually via GitHub releases page.
