# Invite Competition Bot

A production-oriented Discord bot focused on invite attribution and invite competitions. V1 includes durable SQLite storage, restart-safe invite caching, fake-invite detection, rejoin protection, invite logs, statistics, leaderboard, history, bonus management, and confirmed resets.

## Features

- Discord slash commands only
- Invite attribution by comparing cached and freshly fetched server invite usage
- Vanity invite awareness where Discord exposes usage data
- Valid invite rule: the invited account must be at least 7 days old, must not be a bot, and must not have a prior invite record
- Separate total, valid, fake, left, and bonus invite statistics
- A member who leaves is removed from valid invites and added to left invites
- A rejoin is recorded as `rejoined` and never counted as a new invite
- SQLite with WAL mode for local development and a repository-style database service that can be replaced by PostgreSQL later
- Structured logs through Pino
- Minimal purple, green, orange, and red embeds

If Discord cannot provide a reliable attribution (for example, invite fetching is temporarily unavailable or the join used a vanity URL with no inviter), the member is recorded as `unattributed` and no inviter score is changed. The data is retained for inspection instead of guessing.

## Project structure

```text
src/
  index.ts                    # Client startup, event wiring, command dispatch
  deploy-commands.ts          # Guild slash-command deployment
  config/config.ts            # Environment validation and runtime settings
  commands/                   # One module per slash command
  events/                     # Ready, member, and invite lifecycle events
  services/
    database.ts               # Persistence/repository layer
    inviteCache.ts            # In-memory + persisted invite usage cache
    inviteTracker.ts          # Join/leave attribution and logging rules
  database/
    models.ts                 # Persistence input/output types
    migrations/001_initial.sql
  utils/
    embeds.ts                 # Consistent Discord embeds
    logger.ts                 # Pino logging
    permissions.ts             # Server/admin permission guards
```

The invite tracker has no command-specific logic. Future modules such as giveaways, moderation, tickets, economy, affiliate tracking, or dashboards can be added as separate command/event/service modules without rewriting the invite lifecycle.

## Setup

1. Create a Discord application and bot in the Discord Developer Portal.
2. Copy `.env.example` to `.env`.
3. Put your bot token in:

   ```env
   BOT_TOKEN=your_actual_bot_token
   ```

   Never commit `.env` or send the token in chat.

4. Fill in:

   ```env
   CLIENT_ID=your_application_id
   GUILD_ID=your_test_server_id
   ```

5. Install dependencies:

   ```bash
   pnpm install
   ```

6. Register the V1 slash commands in the configured server:

   ```bash
   pnpm run deploy-commands
   ```

7. Start the bot.

## Exact Replit run command

```bash
pnpm start
```

For development with automatic TypeScript restarts:

```bash
pnpm dev
```

## Discord Developer Portal configuration

Enable these Gateway Intents on the Bot page:

- **Server Members Intent** — required for `guildMemberAdd` and `guildMemberRemove`
- **Guild Invites Intent** — required for invite create/delete events

The bot also requests the standard **Guilds** intent for slash commands and server metadata.

Invite attribution additionally requires the bot's role to have **Manage Server** (`Manage Guild`) permission in the target server. The bot should also be able to view the configured invite log channel and send embeds there.

When inviting the bot, request the `bot` and `applications.commands` scopes. Grant at least:

- View Channels
- Send Messages
- Embed Links
- Manage Server

The bot does not request or use message content.

## Invite log channel

Create or choose a channel, copy its channel ID, and set:

```env
INVITE_LOG_CHANNEL_ID=123456789012345678
```

To copy a channel ID, enable Developer Mode in Discord, right-click the channel, and choose **Copy Channel ID**. Restart the bot after changing the environment variable.

## Commands

Regular members:

- `/invites` — your statistics
- `/invites user:@member` — another member's statistics
- `/leaderboard` — top 10 by valid plus bonus invites
- `/invitedby user:@member` — original invite attribution

Manage Server administrators:

- `/invitehistory user:@member`
- `/addinvites user:@member amount:5`
- `/removeinvites user:@member amount:5`
- `/resetinvites user:@member` — requires button confirmation

Server owner or administrator:

- `/resetallinvites` — requires button confirmation

## Testing attribution

Use a test server and two non-bot Discord accounts:

1. Start the bot with the correct `GUILD_ID`, token, intents, and `INVITE_LOG_CHANNEL_ID`.
2. Run `pnpm run deploy-commands`.
3. Have the inviter create a normal, non-expiring invite.
4. Join with a test account created more than 7 days ago.
5. Confirm the log says `Valid Invite`, the inviter's valid count increased, and `/invitedby user:@test-account` shows the expected code and inviter.
6. Leave with the invited account. Confirm the log says `Removed from Valid Invites`, valid decreases by one, and left increases by one.
7. Rejoin using the same or another invite. Confirm the log says `Member Rejoined` and no new valid or total invite is added.
8. Repeat with a Discord account created less than 7 days ago. Confirm the log says `Fake Invite` and only fake invites increase.
9. Run `/leaderboard` and confirm only valid plus bonus invites affect ranking.

Discord invite usage is fetched from the API at join time and compared with the bot's last known cache. Avoid testing many simultaneous joins; the bot serializes database writes but Discord may expose invite usage updates with a short delay.

## Persistence and PostgreSQL path

The database service is isolated behind `src/services/database.ts`, and SQL is kept in `src/database/migrations/`. The rest of the bot depends on the service API rather than SQLite-specific calls. A future PostgreSQL adapter can implement the same operations while keeping commands and invite tracking unchanged.

Local data is written to `DATABASE_PATH` and survives process restarts. The default is `./data/invites.sqlite`.

## Validation

```bash
pnpm run typecheck:bot
pnpm run typecheck
```