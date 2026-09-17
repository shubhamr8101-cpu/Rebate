import { SlashCommandBuilder } from "discord.js";
import type { CommandModule } from "../types.js";
import { leaderboardEmbed } from "../utils/embeds.js";
import { requireGuild } from "./helpers.js";

export const leaderboardCommand: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the top 10 invite competition members."),
  async execute(interaction, { database }) {
    if (!requireGuild(interaction)) return;
    const rows = database.getLeaderboard(interaction.guildId);
    const displayRows = await Promise.all(
      rows.map(async (row, index) => {
        try {
          const user = await interaction.client.users.fetch(row.userId);
          return {
            position: index + 1,
            username: `${user}`,
            score: row.score,
          };
        } catch {
          return {
            position: index + 1,
            username: `<@${row.userId}>`,
            score: row.score,
          };
        }
      }),
    );
    await interaction.reply({ embeds: [leaderboardEmbed(displayRows)] });
  },
};