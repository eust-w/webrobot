# GitHub Pages Deployment

This project deploys the Vite `dist` output with GitHub Actions and GitHub
Pages. External organization-specific deployment settings are not used.

## Target

- Repository: `eust-w/webrobot`
- Automatic trigger: any pushed Git tag
- Build output: `dist`
- Expected Pages URL: `https://eust-w.github.io/webrobot/`

If the repository is moved to another owner, the Pages URL changes to:

```text
https://<owner>.github.io/webrobot/
```

## First-Time Repository Setup

1. Open the repository on GitHub.
2. Go to Settings -> Pages.
3. Under Build and deployment, set Source to GitHub Actions.
4. Push a Git tag or run the `Deploy GitHub Pages` workflow manually.

The workflow builds the Vite app, uploads `dist` as a GitHub Pages artifact, and
deploys it through `actions/deploy-pages`.

## Release by Tag

Use a semantic version tag or any other release tag name:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow listens to `push.tags: ["*"]`, so every pushed tag can publish the
current tagged commit to GitHub Pages. Ordinary branch pushes do not deploy the
site.

## Why `base: "./"`

GitHub Pages project sites are served under a repository subpath such as
`/webrobot/`. The Vite config uses a relative base so built JavaScript and CSS
assets still load correctly from that subpath, while runtime public assets are
resolved with `import.meta.env.BASE_URL` in the app code.
