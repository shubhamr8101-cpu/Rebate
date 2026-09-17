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

export const resetInvitesCommand: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("resetinvites")
    .setDescription("Reset one member's invite statistics.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option.setName("user").setDescription("The member.").setRequired(true),
    ),
  async execute(interaction) {
    if (!requireGuild(interaction) || !requireAdmin(interaction)) return;
    const user = interaction.options.getUser("user", true);
    const customId = `confirm-reset-user:${interaction.guildId}:${user.id}:${interaction.user.id}`;
    await interaction.reply({
      embeds: [
        infoEmbed(
          "Confirm Invite Reset",
          `Reset all invite statistics for ${user}? This clears valid, fake, left, and bonus invites for this member.`,
        ),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(customId)
            .setLabel("Confirm Reset")
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