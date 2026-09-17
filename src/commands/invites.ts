import { SlashCommandBuilder } from "discord.js";
import type { CommandModule } from "../types.js";
import { inviteStatsEmbed } from "../utils/embeds.js";
import { requireGuild } from "./helpers.js";

export const invitesCommand: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("invites")
    .setDescription("Show invite statistics for you or another member.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member whose statistics you want to see.")
        .setRequired(false),
    ),
  async execute(interaction, { database }) {
    if (!requireGuild(interaction)) return;
    const user = interaction.options.getUser("user") ?? interaction.user;
    const stats = database.getStats(interaction.guildId, user.id);
    await interaction.reply({
      embeds: [inviteStatsEmbed(`${user}`, stats)],
    });
  },
};