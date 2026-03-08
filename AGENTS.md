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

- **Manual Operations Only:** NEVER stage, commit, or push changes automatically.
- **Two-Turn Protocol:**
  1.  **Turn 1 (Proposal):** Present `git status` and a proposed commit message derived from the actual code diff. Stop and wait for user approval.
  2.  **Turn 2 (Execution):** Only after receiving explicit confirmation (e.g., "Commit", "Push", "Go ahead") in the **current turn**, proceed with the requested actions.
- **NO CARRY-OVER PERMISSION:** An authorization to push or commit only applies to the specific changes proposed in that turn. You must NEVER assume permission to commit subsequent changes based on a previous turn's approval.
- **Transparency:** Always verify and display the outcome of git operations (e.g., via `git status`) immediately after execution.
- **No Force Pushing:** Never force push to a remote repository unless explicitly directed to do so by the user.

### Architecture

- **Separation of Concerns:** Keep data access logic in `DataService` (MixedDataModel), business logic in modules, and API handling in `server.ts`.
- **Native Modules:** Be aware that some helpers (like `fetch-feed` and `fetch-links`) use Rust-based native modules via N-API.

## Security & System Integrity

- **Credentials:** NEVER log, print, or commit secrets, API keys, or sensitive credentials.
- **Source Control:** Do not stage or commit changes unless specifically requested by the user.
