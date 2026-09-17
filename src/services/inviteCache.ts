import type { Collection, Guild, Invite } from "discord.js";
import { logger } from "../utils/logger.js";
import type { Database } from "./database.js";

export type CachedInvite = {
  code: string;
  inviterId: string | null;
  uses: number;
  isVanity: boolean;
};

export type DetectedInvite = CachedInvite | null;

export class InviteCache {
  private readonly cache = new Map<string, Map<string, CachedInvite>>();
  private readonly refreshLocks = new Map<string, Promise<void>>();

  constructor(private readonly database: Database) {}

  async initialize(guilds: Iterable<Guild>): Promise<void> {
    for (const guild of guilds) {
      await this.hydrateGuild(guild);
    }
  }

  async hydrateGuild(guild: Guild): Promise<void> {
    const persisted = this.database.getInviteCodes(guild.id);
    const previous = new Map<string, CachedInvite>(
      persisted.map((invite) => [
        invite.code,
        {
          code: invite.code,
          inviterId: invite.inviterId,
          uses: invite.uses,
          isVanity: invite.isVanity,
        },
      ]),
    );
    this.cache.set(guild.id, previous);

    try {
      const current = await this.fetchGuildInvites(guild);
      this.cache.set(guild.id, current);
      for (const invite of current.values()) {
        this.database.upsertInviteCode({
          guildId: guild.id,
          code: invite.code,
          inviterId: invite.inviterId,
          uses: invite.uses,
          isVanity: invite.isVanity,
        });
      }
      logger.info(
        { guildId: guild.id, inviteCount: current.size },
        "Invite cache hydrated",
      );
    } catch (error) {
      logger.error({ err: error, guildId: guild.id }, "Failed to hydrate invite cache");
    }
  }

  async detectUsedInvite(guild: Guild): Promise<DetectedInvite> {
    const previousRefresh = this.refreshLocks.get(guild.id) ?? Promise.resolve();
    let release!: () => void;
    const currentRefresh = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queuedRefresh = previousRefresh.then(() => currentRefresh);
    this.refreshLocks.set(guild.id, queuedRefresh);
    await previousRefresh;
    try {
      return await this.refreshAndDetect(guild);
    } finally {
      release();
      if (this.refreshLocks.get(guild.id) === queuedRefresh) {
        this.refreshLocks.delete(guild.id);
      }
    }
  }

  private async refreshAndDetect(guild: Guild): Promise<DetectedInvite> {
    const before = this.cache.get(guild.id) ?? new Map();
    try {
      const after = await this.fetchGuildInvites(guild);
      let increased: CachedInvite | null = null;
      let largestIncrease = 0;

      for (const invite of after.values()) {
        const previousUses = before.get(invite.code)?.uses ?? 0;
        const increase = invite.uses - previousUses;
        if (increase > largestIncrease) {
          largestIncrease = increase;
          increased = invite;
        }
      }

      this.cache.set(guild.id, after);
      for (const invite of after.values()) {
        this.database.upsertInviteCode({
          guildId: guild.id,
          code: invite.code,
          inviterId: invite.inviterId,
          uses: invite.uses,
          isVanity: invite.isVanity,
        });
      }
      return increased;
    } catch (error) {
      logger.error(
        { err: error, guildId: guild.id },
        "Failed to refresh invites while attributing member",
      );
      return null;
    }
  }

  onInviteCreate(input: {
    guildId: string;
    code: string;
    inviterId: string | null;
    uses: number;
  }): void {
    const guildCache = this.cache.get(input.guildId) ?? new Map();
    const invite = {
      code: input.code,
      inviterId: input.inviterId,
      uses: input.uses,
      isVanity: false,
    };
    guildCache.set(input.code, invite);
    this.cache.set(input.guildId, guildCache);
    this.database.upsertInviteCode({
      guildId: input.guildId,
      code: input.code,
      inviterId: input.inviterId,
      uses: input.uses,
    });
  }

  onInviteDelete(guildId: string, code: string): void {
    this.cache.get(guildId)?.delete(code);
    this.database.deleteInviteCode(guildId, code);
  }

  private async fetchGuildInvites(
    guild: Guild,
  ): Promise<Map<string, CachedInvite>> {
    const invites: Collection<string, Invite> = await guild.invites.fetch();
    const current = new Map<string, CachedInvite>();
    for (const invite of invites.values()) {
      current.set(invite.code, {
        code: invite.code,
        inviterId: invite.inviter?.id ?? null,
        uses: invite.uses ?? 0,
        isVanity: false,
      });
    }

    if (guild.features.includes("VANITY_URL") && guild.vanityURLCode) {
      try {
        const vanity = await guild.fetchVanityData();
        current.set(guild.vanityURLCode, {
          code: guild.vanityURLCode,
          inviterId: null,
          uses: vanity.uses ?? 0,
          isVanity: true,
        });
      } catch (error) {
        logger.warn(
          { err: error, guildId: guild.id },
          "Unable to fetch vanity invite usage",
        );
      }
    }
    return current;
  }
}