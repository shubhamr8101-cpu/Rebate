import {
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";

export function isGuildInteraction(
  interaction: ChatInputCommandInteraction,
): boolean {
  return Boolean(interaction.guildId && interaction.guild);
}

export function isAdminOrOwner(
  interaction: ChatInputCommandInteraction,
): boolean {
  if (!interaction.guild || !interaction.memberPermissions) return false;
  return (
    interaction.guild.ownerId === interaction.user.id ||
    interaction.memberPermissions.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)
  );
}