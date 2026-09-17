import type { Client, GuildMember, PartialGuildMember } from "discord.js";
import type { InviteTracker } from "../services/inviteTracker.js";
import { logger } from "../utils/logger.js";

export function registerGuildMemberRemove(
  client: Client,
  tracker: InviteTracker,
): void {
  client.on("guildMemberRemove", (member) => {
    void tracker.handleMemberLeave(member).catch((error) => {
      logger.error(
        { err: error, guildId: member.guild.id, memberId: member.id },
        "Unhandled member leave processing error",
      );
    });
  });
}