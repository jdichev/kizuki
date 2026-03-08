# Gemini CLI Policy Mandates

## Git Operations

- **STRICT DIRECTIVE:** NEVER perform `git commit` or `git push` without explicit, unambiguous confirmation from the user in the **current turn** for the **specific set of changes** being proposed.
- **NO SESSION-WIDE PERMISSION:** Authorization to commit or push once does NOT grant permission for subsequent operations. Every new set of modifications requires a fresh proposal and a fresh "go ahead."
- **PROPOSAL PROTOCOL:** Always present the proposed commit message and a summary of changes first.
- **WAIT FOR APPROVAL:** Stop and wait for the user to say "commit", "push", "go ahead", or similar before executing any git modification commands.
- **NO AUTOMATIC COMMITS:** Even if a task seems complete or was previously discussed, do not assume permission to commit.

## Engineering Standards

- Adhere to the standards defined in `AGENTS.md`.
- Prioritize user verification and testing before proposing a commit.
