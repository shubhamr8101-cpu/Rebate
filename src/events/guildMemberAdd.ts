import type { Client } from "discord.js";
import type { InviteTracker } from "../services/inviteTracker.js";
import { logger } from "../utils/logger.js";

export function registerGuildMemberAdd(
  client: Client,
  tracker: InviteTracker,
): void {
  client.on("guildMemberAdd", (member) => {
    void tracker.handleMemberJoin(member).catch((error) => {
      logger.error(
        { err: error, guildId: member.guild.id, memberId: member.id },
        "Unhandled member join processing error",
      );
    });
  });
}