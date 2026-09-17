import type { Client } from "discord.js";
import type { InviteTracker } from "../services/inviteTracker.js";
import { logger } from "../utils/logger.js";

export function registerReady(client: Client, tracker: InviteTracker): void {
  client.once("ready", async (readyClient) => {
    logger.info(
      { userTag: readyClient.user.tag, guildCount: readyClient.guilds.cache.size },
      "Discord client ready",
    );
    await tracker.initialize();
  });
}