---
name: Node SQLite runtime
description: The bot uses Node 24's built-in SQLite API for local persistence in this workspace.
---

Node 24 provides `node:sqlite`, which avoids native addon build approval in this environment. Native SQLite packages may install with their build scripts blocked, so prefer the built-in API for local bot storage unless the runtime target changes.

**Why:** The workspace package policy blocked the native SQLite addon build during setup, while Node 24's built-in SQLite API worked for schema creation, transactions, and persistence checks.

**How to apply:** Keep the database service isolated behind its repository API so a future PostgreSQL adapter can replace the SQLite implementation without changing commands or invite tracking.