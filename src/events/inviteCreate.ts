import type { Client } from "discord.js";
import type { InviteCache } from "../services/inviteCache.js";

export function registerInviteCreate(
  client: Client,
  inviteCache: InviteCache,
): void {
  client.on("inviteCreate", (invite) => {
    inviteCache.onInviteCreate({
      guildId: invite.guild?.id ?? "",
      code: invite.code,
      inviterId: invite.inviter?.id ?? null,
      uses: invite.uses ?? 0,
    });
  });
}