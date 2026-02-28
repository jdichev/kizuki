# AI Agent Instructions

This document provides foundational mandates and guidelines for AI agents (Gemini, Copilot, etc.) working on this codebase.

## Engineering Standards

### Commit Messages

- **Format:** Always use the **Conventional Commits** format: `<type>(optional-scope): <short summary>`.
- **Types:** Use `feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`, or `chore`.
- **Accuracy:** Derive the message from the **actual code diff** (staged or working changes), not assumptions.
- **Detail:** Keep the subject line detailed and focused on functionality.
- **Description:** Provide a concise list of changes in the description body if the change is complex.
- **Formatting:** Always format commit messages as code blocks when presenting them.

Examples:

- `feat(fetch-links): add napi async export and js wrapper alias`
- `fix(fetch-links): handle invalid url parsing errors in rust binding`
- `refactor(server): rewrite MixedDataModel to use better-sqlite3 directly`

### Coding Style & Conventions

- **TypeScript:** Use strict typing where possible. Avoid `any` unless absolutely necessary or when interacting with poorly typed external libraries.
- **Database:** Use `better-sqlite3` directly for database operations in the server. Prefer synchronous prepared statements within an `async` public interface.
- **Sanitization:** Always sanitize HTML content using `dompurify` before storage or rendering.
- **Logging:** Use `pino` for logging with appropriate levels (`debug`, `info`, `warn`, `error`).

### Git policy

Do not commit, push, or pull automatically. Ask first.

### Architecture

- **Separation of Concerns:** Keep data access logic in `DataService` (MixedDataModel), business logic in modules, and API handling in `server.ts`.
- **Native Modules:** Be aware that some helpers (like `fetch-feed` and `fetch-links`) use Rust-based native modules via N-API.

## Security & System Integrity

- **Credentials:** NEVER log, print, or commit secrets, API keys, or sensitive credentials.
- **Source Control:** Do not stage or commit changes unless specifically requested by the user.
