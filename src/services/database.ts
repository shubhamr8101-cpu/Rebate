import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  HistoryRecord,
  InviteStatus,
  InviteStats,
  InvitedMemberRecord,
} from "../types.js";
import type {
  InviteCodeRow,
  JoinInput,
  JoinResult,
  UserRow,
} from "../database/models.js";
import { logger } from "../utils/logger.js";

type SqlRow = Record<string, string | number | bigint | null>;

function stringValue(row: SqlRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function numberValue(row: SqlRow, key: string): number {
  const value = row[key];
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

export class Database {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath, {
      enableForeignKeyConstraints: true,
      timeout: 5_000,
    });
    const migrationPath = new URL(
      "../database/migrations/001_initial.sql",
      import.meta.url,
    );
    this.db.exec(readFileSync(migrationPath, "utf8"));
    logger.info({ databasePath }, "SQLite database initialized");
  }

  close(): void {
    this.db.close();
  }

  private now(): string {
    return new Date().toISOString();
  }

  ensureUser(guildId: string, userId: string): void {
    const timestamp = this.now();
    this.db
      .prepare(
        `INSERT INTO users (guild_id, user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (guild_id, user_id) DO NOTHING`,
      )
      .run(guildId, userId, timestamp, timestamp);
  }

  getStats(guildId: string, userId: string): InviteStats {
    this.ensureUser(guildId, userId);
    const row = this.db
      .prepare(
        `SELECT guild_id, user_id, total_invites, valid_invites,
                fake_invites, left_invites, bonus_invites
         FROM users WHERE guild_id = ? AND user_id = ?`,
      )
      .get(guildId, userId) as SqlRow | undefined;
    if (!row) throw new Error(`Invite statistics not found for user ${userId}`);
    return {
      guildId: stringValue(row, "guild_id") ?? guildId,
      userId: stringValue(row, "user_id") ?? userId,
      totalInvites: numberValue(row, "total_invites"),
      validInvites: numberValue(row, "valid_invites"),
      fakeInvites: numberValue(row, "fake_invites"),
      leftInvites: numberValue(row, "left_invites"),
      bonusInvites: numberValue(row, "bonus_invites"),
    };
  }

  getUserRow(guildId: string, userId: string): UserRow {
    const stats = this.getStats(guildId, userId);
    const row = this.db
      .prepare(
        `SELECT created_at, updated_at
         FROM users WHERE guild_id = ? AND user_id = ?`,
      )
      .get(guildId, userId) as SqlRow | undefined;
    return {
      ...stats,
      createdAt: stringValue(row ?? {}, "created_at") ?? "",
      updatedAt: stringValue(row ?? {}, "updated_at") ?? "",
    };
  }

  getLeaderboard(
    guildId: string,
    limit = 10,
  ): Array<{ userId: string; score: number }> {
    const rows = this.db
      .prepare(
        `SELECT user_id, valid_invites + bonus_invites AS score
         FROM users
         WHERE guild_id = ? AND (valid_invites + bonus_invites) > 0
         ORDER BY score DESC, valid_invites DESC, user_id ASC
         LIMIT ?`,
      )
      .all(guildId, limit) as SqlRow[];
    return rows.map((row) => ({
      userId: stringValue(row, "user_id") ?? "",
      score: numberValue(row, "score"),
    }));
  }

  upsertInviteCode(input: {
    guildId: string;
    code: string;
    inviterId: string | null;
    uses: number;
    isVanity?: boolean;
  }): void {
    this.db
      .prepare(
        `INSERT INTO invite_codes
           (guild_id, code, inviter_id, uses, is_vanity, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (guild_id, code) DO UPDATE SET
           inviter_id = excluded.inviter_id,
           uses = excluded.uses,
           is_vanity = excluded.is_vanity,
           last_seen_at = excluded.last_seen_at`,
      )
      .run(
        input.guildId,
        input.code,
        input.inviterId,
        Math.max(0, input.uses),
        input.isVanity ? 1 : 0,
        this.now(),
      );
  }

  deleteInviteCode(guildId: string, code: string): void {
    this.db
      .prepare("DELETE FROM invite_codes WHERE guild_id = ? AND code = ?")
      .run(guildId, code);
  }

  getInviteCodes(guildId: string): InviteCodeRow[] {
    const rows = this.db
      .prepare(
        `SELECT guild_id, code, inviter_id, uses, is_vanity, last_seen_at
         FROM invite_codes WHERE guild_id = ?`,
      )
      .all(guildId) as SqlRow[];
    return rows.map((row) => ({
      guildId: stringValue(row, "guild_id") ?? guildId,
      code: stringValue(row, "code") ?? "",
      inviterId: stringValue(row, "inviter_id"),
      uses: numberValue(row, "uses"),
      isVanity: numberValue(row, "is_vanity") === 1,
      lastSeenAt: stringValue(row, "last_seen_at") ?? "",
    }));
  }

  getInvitedMember(
    guildId: string,
    memberId: string,
  ): InvitedMemberRecord | null {
    const row = this.db
      .prepare(
        `SELECT guild_id, member_id, inviter_id, invite_code, joined_at,
                account_created_at, status, counted
         FROM invited_members WHERE guild_id = ? AND member_id = ?`,
      )
      .get(guildId, memberId) as SqlRow | undefined;
    return row ? this.toInvitedMember(row) : null;
  }

  recordJoin(input: JoinInput): JoinResult {
    const existing = this.getInvitedMember(input.guildId, input.memberId);
    if (existing) {
      const now = this.now();
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db
          .prepare(
            `UPDATE invited_members
             SET status = 'rejoined', counted = 0, left_at = NULL, updated_at = ?
             WHERE guild_id = ? AND member_id = ?`,
          )
          .run(now, input.guildId, input.memberId);
        this.insertTransaction({
          guildId: input.guildId,
          memberId: input.memberId,
          inviterId: existing.inviterId,
          inviteCode: input.inviteCode ?? existing.inviteCode,
          eventType: "rejoin",
          status: "rejoined",
          amount: null,
        });
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
      return {
        kind: "rejoin",
        record: {
          ...existing,
          status: "rejoined",
          counted: false,
        },
      };
    }

    const now = this.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `INSERT INTO invited_members
             (guild_id, member_id, inviter_id, invite_code, joined_at,
              account_created_at, status, counted, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.guildId,
          input.memberId,
          input.inviterId,
          input.inviteCode,
          input.joinedAt,
          input.accountCreatedAt,
          input.status,
          input.counted ? 1 : 0,
          now,
        );
      if (input.inviterId && (input.status === "valid" || input.status === "fake")) {
        this.ensureUser(input.guildId, input.inviterId);
        const statColumn = input.status === "valid" ? "valid_invites" : "fake_invites";
        this.db
          .prepare(
            `UPDATE users
             SET total_invites = total_invites + 1,
                 ${statColumn} = ${statColumn} + 1,
                 updated_at = ?
             WHERE guild_id = ? AND user_id = ?`,
          )
          .run(now, input.guildId, input.inviterId);
      }
      this.insertTransaction({
        guildId: input.guildId,
        memberId: input.memberId,
        inviterId: input.inviterId,
        inviteCode: input.inviteCode,
        eventType: "join",
        status: input.status,
        amount: input.counted ? 1 : 0,
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return { kind: "new", record: { ...input } };
  }

  recordLeave(guildId: string, memberId: string): {
    record: InvitedMemberRecord | null;
    validInviteRemoved: boolean;
  } {
    const existing = this.getInvitedMember(guildId, memberId);
    if (!existing || existing.status === "left") {
      return { record: existing, validInviteRemoved: false };
    }
    const now = this.now();
    const removedValid = existing.status === "valid" && existing.counted;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `UPDATE invited_members
           SET status = 'left', counted = 0, left_at = ?, updated_at = ?
           WHERE guild_id = ? AND member_id = ?`,
        )
        .run(now, now, guildId, memberId);
      if (removedValid && existing.inviterId) {
        this.db
          .prepare(
            `UPDATE users
             SET valid_invites = MAX(valid_invites - 1, 0),
                 left_invites = left_invites + 1,
                 updated_at = ?
             WHERE guild_id = ? AND user_id = ?`,
          )
          .run(now, guildId, existing.inviterId);
      }
      this.insertTransaction({
        guildId,
        memberId,
        inviterId: existing.inviterId,
        inviteCode: existing.inviteCode,
        eventType: "leave",
        status: "left",
        amount: removedValid ? -1 : 0,
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return {
      record: { ...existing, status: "left", counted: false },
      validInviteRemoved: removedValid,
    };
  }

  findInvitedBy(
    guildId: string,
    memberId: string,
  ): InvitedMemberRecord | null {
    return this.getInvitedMember(guildId, memberId);
  }

  getInviteHistory(
    guildId: string,
    inviterId: string,
    limit = 20,
  ): HistoryRecord[] {
    const rows = this.db
      .prepare(
        `SELECT im.guild_id, im.member_id, im.inviter_id, im.invite_code,
                im.joined_at, im.account_created_at, im.status, im.counted,
                u.user_id AS username
         FROM invited_members im
         LEFT JOIN users u ON u.guild_id = im.guild_id AND u.user_id = im.member_id
         WHERE im.guild_id = ? AND im.inviter_id = ?
         ORDER BY im.joined_at DESC
         LIMIT ?`,
      )
      .all(guildId, inviterId, limit) as SqlRow[];
    return rows.map((row) => ({
      ...this.toInvitedMember(row),
      username: stringValue(row, "username"),
    }));
  }

  adjustBonus(
    guildId: string,
    userId: string,
    amount: number,
  ): InviteStats {
    this.ensureUser(guildId, userId);
    const now = this.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `UPDATE users
           SET bonus_invites = MAX(bonus_invites + ?, 0), updated_at = ?
           WHERE guild_id = ? AND user_id = ?`,
        )
        .run(amount, now, guildId, userId);
      this.insertTransaction({
        guildId,
        memberId: null,
        inviterId: userId,
        inviteCode: null,
        eventType: amount >= 0 ? "bonus_add" : "bonus_remove",
        status: "bonus",
        amount,
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.getStats(guildId, userId);
  }

  resetUser(guildId: string, userId: string): void {
    const now = this.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `UPDATE users SET total_invites = 0, valid_invites = 0,
             fake_invites = 0, left_invites = 0, bonus_invites = 0,
             updated_at = ? WHERE guild_id = ? AND user_id = ?`,
        )
        .run(now, guildId, userId);
      this.db
        .prepare(
          `UPDATE invited_members
           SET counted = 0, updated_at = ?
           WHERE guild_id = ? AND inviter_id = ?`,
        )
        .run(now, guildId, userId);
      this.insertTransaction({
        guildId,
        memberId: null,
        inviterId: userId,
        inviteCode: null,
        eventType: "reset",
        status: "user",
        amount: null,
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  resetAll(guildId: string): void {
    const now = this.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("DELETE FROM invite_transactions WHERE guild_id = ?")
        .run(guildId);
      this.db
        .prepare("DELETE FROM invited_members WHERE guild_id = ?")
        .run(guildId);
      this.db.prepare("DELETE FROM users WHERE guild_id = ?").run(guildId);
      this.db
        .prepare(
          `INSERT INTO invite_transactions
             (guild_id, event_type, status, metadata, created_at)
           VALUES (?, 'reset', 'all', ?, ?)`,
        )
        .run(guildId, JSON.stringify({ resetAt: now }), now);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private insertTransaction(input: {
    guildId: string;
    memberId: string | null;
    inviterId: string | null;
    inviteCode: string | null;
    eventType: string;
    status: string;
    amount: number | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO invite_transactions
           (guild_id, member_id, inviter_id, invite_code,
            event_type, status, amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.guildId,
        input.memberId,
        input.inviterId,
        input.inviteCode,
        input.eventType,
        input.status,
        input.amount,
        this.now(),
      );
  }

  private toInvitedMember(row: SqlRow): InvitedMemberRecord {
    return {
      guildId: stringValue(row, "guild_id") ?? "",
      memberId: stringValue(row, "member_id") ?? "",
      inviterId: stringValue(row, "inviter_id"),
      inviteCode: stringValue(row, "invite_code"),
      joinedAt: stringValue(row, "joined_at") ?? "",
      accountCreatedAt: stringValue(row, "account_created_at") ?? "",
      status: (stringValue(row, "status") ?? "unattributed") as InviteStatus,
      counted: numberValue(row, "counted") === 1,
    };
  }
}