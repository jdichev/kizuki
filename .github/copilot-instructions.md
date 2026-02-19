# Copilot Instructions

## Commit messages

- When asked to suggest or write a commit message, always use the **Conventional Commits** format.
- Derive the message from the **actual code diff** (staged or working changes), not from assumptions.
- Pick the most accurate type for the diff, such as `feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`, or `chore`.
- Keep the subject line detailed and correct, with focus on functionality.
- The description text should contain a concise list of the changes.
- When presenting commit messages, always format them as code.

Format:

`<type>(optional-scope): <short summary of what changed>`

Examples:

- `feat(fetch-links): add napi async export and js wrapper alias`
- `fix(fetch-links): handle invalid url parsing errors in rust binding`
- `docs(fetch-links): simplify helper readme and usage`
