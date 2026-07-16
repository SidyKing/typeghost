# Publishing TypeGhost

Release channels and how to ship to each. Versions follow semver; bump the
relevant `package.json` / `build.gradle.kts` before publishing.

## npm — `@typeghost/core`

One-time setup:
1. `npm login` (on the machine you publish from).
2. Create the free **typeghost** organization: https://www.npmjs.com/org/create
   (scoped packages need their scope to exist as your username or an org).
   If the name is taken, rename the package to the unscoped `typeghost-core`.

Publish:
```bash
npm publish -w @typeghost/core
```
`prepublishOnly` rebuilds and runs the test suite automatically.

## VS Code Marketplace

Listing: https://marketplace.visualstudio.com/items?itemName=PapaSidyMactarTRAORE.typeghost

```bash
cd packages/vscode-extension
npm run package        # produces typeghost-<version>.vsix
```
Upload the `.vsix` on https://marketplace.visualstudio.com/manage
(publisher **PapaSidyMactarTRAORE**), or use `vsce publish` with an Azure
DevOps PAT (Marketplace → Manage scope).

## Open VSX (VSCodium, Gitpod, code-server…)

One-time setup:
1. Create an Eclipse account: https://accounts.eclipse.org/user/register
2. Sign the Open VSX Publisher Agreement (linked from your profile).
3. Generate an access token: https://open-vsx.org/user-settings/tokens
4. Create the namespace (must match the extension's `publisher`):
   ```bash
   npx ovsx create-namespace PapaSidyMactarTRAORE -p <token>
   ```

Publish the same `.vsix` as the VS Code Marketplace:
```bash
npx ovsx publish packages/vscode-extension/typeghost-<version>.vsix -p <token>
```

## JetBrains Marketplace

```bash
cd packages/jetbrains-plugin
./gradlew test buildPlugin     # zip in build/distributions/
```
Upload on https://plugins.jetbrains.com (vendor **SidyKing**). First upload
goes through a ~2-business-day human review; updates are fast. Can be
automated later with `./gradlew publishPlugin` and a Marketplace token.

## Web demo (GitHub Pages)

Deployed automatically on every push to `main` by
`.github/workflows/pages.yml` — nothing to do.
