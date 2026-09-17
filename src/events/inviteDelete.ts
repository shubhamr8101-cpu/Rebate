import type { Client } from "discord.js";
import type { InviteCache } from "../services/inviteCache.js";

export function registerInviteDelete(
  client: Client,
  inviteCache: InviteCache,
): void {
  client.on("inviteDelete", (invite) => {
    if (invite.guild?.id) inviteCache.onInviteDelete(invite.guild.id, invite.code);
  });
}