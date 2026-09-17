import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { CommandModule } from "../types.js";
import { successEmbed } from "../utils/embeds.js";
import {
  parsePositiveAmount,
  requireAdmin,
  requireGuild,
} from "./helpers.js";

export const removeInvitesCommand: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("removeinvites")
    .setDescription("Remove bonus invites from a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option.setName("user").setDescription("The member.").setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of bonus invites to remove.")
        .setMinValue(1)
        .setMaxValue(1_000_000)
        .setRequired(true),
    ),
  async execute(interaction, { database }) {
    if (!requireGuild(interaction) || !requireAdmin(interaction)) return;
    const amount = parsePositiveAmount(interaction);
    if (!amount) return;
    const user = interaction.options.getUser("user", true);
    const before = database.getStats(interaction.guildId, user.id);
    const stats = database.adjustBonus(interaction.guildId, user.id, -amount);
    const removed = before.bonusInvites - stats.bonusInvites;
    await interaction.reply({
      embeds: [
        successEmbed(
          "Bonus Invites Removed",
          `${user} lost **${removed}** bonus invite${removed === 1 ? "" : "s"}.\n\nCurrent bonus invites: **${stats.bonusInvites}**`,
        ),
      ],
    });
  },
};