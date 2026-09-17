import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { CommandModule } from "../types.js";
import { successEmbed } from "../utils/embeds.js";
import {
  parsePositiveAmount,
  requireAdmin,
  requireGuild,
} from "./helpers.js";

export const addInvitesCommand: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("addinvites")
    .setDescription("Add bonus invites to a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option.setName("user").setDescription("The member.").setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of bonus invites to add.")
        .setMinValue(1)
        .setMaxValue(1_000_000)
        .setRequired(true),
    ),
  async execute(interaction, { database }) {
    if (!requireGuild(interaction) || !requireAdmin(interaction)) return;
    const amount = parsePositiveAmount(interaction);
    if (!amount) return;
    const user = interaction.options.getUser("user", true);
    const stats = database.adjustBonus(interaction.guildId, user.id, amount);
    await interaction.reply({
      embeds: [
        successEmbed(
          "Bonus Invites Added",
          `${user} received **${amount}** bonus invite${amount === 1 ? "" : "s"}.\n\nCurrent bonus invites: **${stats.bonusInvites}**`,
        ),
      ],
    });
  },
};