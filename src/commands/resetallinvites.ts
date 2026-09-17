import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandModule } from "../types.js";
import { infoEmbed } from "../utils/embeds.js";
import { requireAdmin, requireGuild } from "./helpers.js";

export const resetAllInvitesCommand: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("resetallinvites")
    .setDescription("Reset the entire invite competition database.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!requireGuild(interaction) || !requireAdmin(interaction)) return;
    const customId = `confirm-reset-all:${interaction.guildId}:${interaction.user.id}`;
    await interaction.reply({
      embeds: [
        infoEmbed(
          "Confirm Full Reset",
          "This permanently clears every inviter statistic, invited-member record, and transaction history for this server.",
        ),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(customId)
            .setLabel("Confirm Full Reset")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`cancel-reset:${interaction.user.id}`)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
      ephemeral: true,
    });
  },
};