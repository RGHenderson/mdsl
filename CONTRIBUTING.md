# Contributing

## Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are validated by [commitlint](https://commitlint.js.org/) via a git hook.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | When to use                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature (minor version bump)                        |
| `fix`      | Bug fix (patch version bump)                            |
| `docs`     | Documentation only                                      |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Tests only                                              |
| `build`    | Build system or dependencies                            |
| `ci`       | CI configuration                                        |
| `chore`    | Maintenance (hidden from changelog)                     |

### Scopes (optional)

`core`, `cli`, `docs`, `deps`, `ci`, `release`

### Examples

```
feat(core): add optional section shorthand
fix(cli): format diagnostics on validate failure
docs: document heading level rules
chore(deps): bump vitest
```

### Breaking changes

Add `BREAKING CHANGE:` in the footer, or append `!` after the type:

```
feat(core)!: rename defineDocument map keys

BREAKING CHANGE: map keys must now match schema field names exactly.
```

## Releases

Changelog and version bumps are generated from commit history:

```bash
npm run release
```

This runs `commit-and-tag-version`, which:

1. Determines the next semver from commits since the last tag
2. Updates `CHANGELOG.md` and `package.json`
3. Creates a release commit and git tag

### Dry run

```bash
npm run release:dry
```

### Publishing

Releases are cut from `main` only:

```bash
npm run release
git push origin main --tags
```

Pushing a `v*` tag triggers npm publish via GitHub Actions. Add an `NPM_TOKEN` secret (Automation token with publish access) to the repository settings.

## Development

```bash
npm run check
```
