# Gemini CLI Policy Mandates

## Git Operations

- **STRICT DIRECTIVE:** NEVER perform `git commit` or `git push` without explicit, unambiguous confirmation from the user in the current turn.
- **PROPOSAL PROTOCOL:** Always present the proposed commit message and a summary of changes first.
- **WAIT FOR APPROVAL:** Stop and wait for the user to say "commit", "push", "go ahead", or similar before executing any git modification commands.
- **NO AUTOMATIC COMMITS:** Even if a task seems complete, do not assume permission to commit.

## Engineering Standards

- Adhere to the standards defined in `AGENTS.md`.
- Prioritize user verification and testing before proposing a commit.
