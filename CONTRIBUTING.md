# Contributing to PacificBoard

Thank you for helping improve PacificBoard. Bug fixes, documentation, tests, and feature ideas are welcome.

## Before you start

1. Check the existing issues and pull requests to avoid duplicating work.
2. For a significant feature, open an issue first so the design can be discussed.
3. Never include secrets, private keys, production data, or real credentials in a change.

## Development setup

1. Install Node.js 18 or newer, Git, and PacificDB Community Edition.
2. Clone the repository and copy `backend/.env.example` to `backend/.env`.
3. Start PacificDB on `127.0.0.1:9000`.
4. Install dependencies in both `backend/` and `frontend/`.
5. Run the backend and frontend development servers using the commands in the README.

## Making changes

- Keep changes focused and avoid unrelated formatting changes.
- Follow the existing JavaScript, TypeScript, React, and Express patterns.
- Update documentation when behavior, configuration, or API endpoints change.
- Add or update tests when practical.
- Do not commit `.env` files, credentials, generated build output, or large temporary files.

## Validation

Before opening a pull request, run the checks available for the area you changed:

```bash
cd frontend
npm run lint
npm run build
```

For backend changes, start the API locally and exercise the affected endpoint against a running PacificDB instance.

## Pull requests

- Use a clear title that describes the change.
- Explain what changed and why.
- Include setup or migration notes when needed.
- Link related issues using GitHub keywords such as `Fixes #123`.
- Add screenshots or recordings for user-interface changes.
- Confirm that you have tested the change locally.

By contributing, you agree that your contribution will be licensed under the repository's MIT License.
