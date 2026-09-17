import type {
  ChatInputCommandInteraction,
  GuildMember,
  User,
} from "discord.js";
import { errorEmbed } from "../utils/embeds.js";
import { isAdminOrOwner, isGuildInteraction } from "../utils/permissions.js";

export function requireGuild(
  interaction: ChatInputCommandInteraction,
): interaction is ChatInputCommandInteraction & {
  guildId: string;
  guild: NonNullable<ChatInputCommandInteraction["guild"]>;
} {
  if (isGuildInteraction(interaction)) return true;
  void interaction.reply({
    embeds: [errorEmbed("Server Only", "This command can only be used in a server.")],
    ephemeral: true,
  });
  return false;
}

export function requireAdmin(
  interaction: ChatInputCommandInteraction,
): boolean {
  if (isAdminOrOwner(interaction)) return true;
  void interaction.reply({
    embeds: [
      errorEmbed(
        "Permission Denied",
        "You need the Manage Server permission to use this command.",
      ),
    ],
    ephemeral: true,
  });
  return false;
}

export function displayUser(user: User | GuildMember | null): string {
  return user ? `${user}` : "Unknown user";
}

export function parsePositiveAmount(
  interaction: ChatInputCommandInteraction,
): number | null {
  const amount = interaction.options.getInteger("amount", true);
  if (amount < 1 || amount > 1_000_000) {
    void interaction.reply({
      embeds: [
        errorEmbed(
          "Invalid Amount",
          "Amount must be a whole number between 1 and 1,000,000.",
        ),
      ],
      ephemeral: true,
    });
    return null;
  }
  return amount;
}