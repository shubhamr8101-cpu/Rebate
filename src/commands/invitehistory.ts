import { SlashCommandBuilder } from "discord.js";
import type { CommandModule } from "../types.js";
import { infoEmbed } from "../utils/embeds.js";
import { requireAdmin, requireGuild } from "./helpers.js";

export const inviteHistoryCommand: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("invitehistory")
    .setDescription("Show recent members invited by a user.")
    .setDefaultMemberPermissions("32")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The inviter whose history you want to see.")
        .setRequired(true),
    ),
  async execute(interaction, { database }) {
    if (!requireGuild(interaction) || !requireAdmin(interaction)) return;
    const user = interaction.options.getUser("user", true);
    const history = database.getInviteHistory(interaction.guildId, user.id, 20);
    const description =
      history.length === 0
        ? `${user} has no recorded invite history.`
        : history
            .map(
              (record, index) =>
                `**${index + 1}.** <@${record.memberId}> — ${record.status} — ${record.inviteCode ?? "no code"} — <t:${Math.floor(new Date(record.joinedAt).getTime() / 1000)}:d>`,
            )
            .join("\n");
    await interaction.reply({
      embeds: [
        infoEmbed(
          `Invite History: ${user}`,
          `${description}\n\nShowing the 20 most recent first-time joins.`,
        ),
      ],
    });
  },
};