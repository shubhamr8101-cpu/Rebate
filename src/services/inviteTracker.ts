import {
  EmbedBuilder,
  type Client,
  type GuildMember,
  type PartialGuildMember,
  type TextChannel,
} from "discord.js";
import { config } from "../config/config.js";
import type { InviteStatus } from "../types.js";
import { inviteLogEmbed, infoEmbed } from "../utils/embeds.js";
import { logger } from "../utils/logger.js";
import { Database } from "./database.js";
import { InviteCache, type DetectedInvite } from "./inviteCache.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export class InviteTracker {
  constructor(
    private readonly client: Client,
    private readonly database: Database,
    private readonly inviteCache: InviteCache,
  ) {}

  async initialize(): Promise<void> {
    await this.inviteCache.initialize(this.client.guilds.cache.values());
  }

  async handleMemberJoin(member: GuildMember): Promise<void> {
    const detected: DetectedInvite = await this.inviteCache.detectUsedInvite(
      member.guild,
    );
    const accountAgeDays = Math.max(
      0,
      Math.floor((Date.now() - member.user.createdTimestamp) / DAY_MS),
    );
    let status: InviteStatus;
    if (member.user.bot) {
      status = "bot";
    } else if (!detected) {
      status = "unattributed";
    } else if (accountAgeDays < config.minimumAccountAgeDays) {
      status = "fake";
    } else {
      status = "valid";
    }

    const result = this.database.recordJoin({
      guildId: member.guild.id,
      memberId: member.id,
      inviterId: detected?.inviterId ?? null,
      inviteCode: detected?.code ?? null,
      joinedAt: new Date().toISOString(),
      accountCreatedAt: new Date(member.user.createdTimestamp).toISOString(),
      status,
      counted: status === "valid",
    });

    if (result.kind === "rejoin") {
      logger.info(
        { guildId: member.guild.id, memberId: member.id },
        "Previously recorded member rejoined; no new invite counted",
      );
      await this.sendLog(
        infoEmbed(
          "Member Rejoined",
          `Member: ${member}\nStatus: Previously recorded; no new invite counted.`,
        ),
      );
      return;
    }

    const inviterMention = detected?.inviterId
      ? `<@${detected.inviterId}>`
      : "Unknown / unavailable";
    const code = detected?.code ?? "Unavailable";
    logger.info(
      {
        guildId: member.guild.id,
        memberId: member.id,
        inviterId: detected?.inviterId,
        code,
        status,
      },
      "Member join processed",
    );

    if (status === "valid" && detected?.inviterId) {
      const stats = this.database.getStats(member.guild.id, detected.inviterId);
      await this.sendLog(
        inviteLogEmbed({
          title: "New Member Joined",
          member: `${member}`,
          inviter: inviterMention,
          code,
          accountAgeDays,
          status: "Valid Invite",
          statusColor: "valid",
          inviterValidInvites: stats.validInvites,
        }),
      );
    } else if (status === "fake" && detected?.inviterId) {
      await this.sendLog(
        inviteLogEmbed({
          title: "Suspicious/Fake Invite",
          member: `${member}`,
          inviter: inviterMention,
          code,
          accountAgeDays,
          status: "Fake Invite",
          statusColor: "fake",
        }),
      );
    } else if (status === "unattributed") {
      await this.sendLog(
        infoEmbed(
          "New Member Joined",
          `Member: ${member}\nInvite attribution was unavailable. No invite statistic was changed.`,
        ),
      );
    }
  }

  async handleMemberLeave(
    member: GuildMember | PartialGuildMember,
  ): Promise<void> {
    const result = this.database.recordLeave(member.guild.id, member.id);
    if (!result.record) {
      logger.info(
        { guildId: member.guild.id, memberId: member.id },
        "Member left without an invite record",
      );
      return;
    }
    logger.info(
      {
        guildId: member.guild.id,
        memberId: member.id,
        inviterId: result.record.inviterId,
        validInviteRemoved: result.validInviteRemoved,
      },
      "Member leave processed",
    );
    if (!result.validInviteRemoved || !result.record.inviterId) return;

    const stats = this.database.getStats(member.guild.id, result.record.inviterId);
    await this.sendLog(
      inviteLogEmbed({
        title: "Member Left",
        member: `<@${member.id}>`,
        inviter: `<@${result.record.inviterId}>`,
        code: result.record.inviteCode ?? "Unavailable",
        accountAgeDays: Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(result.record.accountCreatedAt).getTime()) /
              DAY_MS,
          ),
        ),
        status: "Removed from Valid Invites",
        statusColor: "left",
        inviterValidInvites: stats.validInvites,
      }),
    );
  }

  async sendLog(embed: EmbedBuilder): Promise<void> {
    if (!config.inviteLogChannelId) return;
    try {
      const channel = await this.client.channels.fetch(config.inviteLogChannelId);
      if (!channel || !channel.isTextBased() || !("send" in channel)) {
        logger.warn(
          { channelId: config.inviteLogChannelId },
          "Invite log channel is not a sendable text channel",
        );
        return;
      }
      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (error) {
      logger.error({ err: error }, "Failed to send invite log message");
    }
  }

  getDatabase(): Database {
    return this.database;
  }
}