import { SlashCommandBuilder } from "discord.js";
import type { CommandModule } from "../types.js";
import { infoEmbed } from "../utils/embeds.js";
import { requireGuild } from "./helpers.js";

export const invitedByCommand: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("invitedby")
    .setDescription("Show who invited a specific member.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to look up.")
        .setRequired(true),
    ),
  async execute(interaction, { database }) {
    if (!requireGuild(interaction)) return;
    const user = interaction.options.getUser("user", true);
    const record = database.findInvitedBy(interaction.guildId, user.id);
    if (!record) {
      await interaction.reply({
        embeds: [
          infoEmbed(
            "Invite Attribution",
            `${user} does not have a recorded invite history in this server.`,
          ),
        ],
      });
      return;
    }
    const inviter = record.inviterId
      ? `<@${record.inviterId}>`
      : "Unknown / unavailable";
    await interaction.reply({
      embeds: [
        infoEmbed(
          "Invite Attribution",
          [
            `Member: ${user}`,
            `Invited By: ${inviter}`,
            `Invite Code: ${record.inviteCode ?? "Unavailable"}`,
            `Status: ${record.status[0].toUpperCase()}${record.status.slice(1)}`,
            `Joined: <t:${Math.floor(new Date(record.joinedAt).getTime() / 1000)}:F>`,
          ].join("\n"),
        ),
      ],
    });
  },
};