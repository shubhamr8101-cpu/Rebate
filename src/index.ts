import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  type ButtonInteraction,
} from "discord.js";
import { commands, commandMap } from "./commands/index.js";
import { config } from "./config/config.js";
import { registerGuildMemberAdd } from "./events/guildMemberAdd.js";
import { registerGuildMemberRemove } from "./events/guildMemberRemove.js";
import { registerInviteCreate } from "./events/inviteCreate.js";
import { registerInviteDelete } from "./events/inviteDelete.js";
import { registerReady } from "./events/ready.js";
import { Database } from "./services/database.js";
import { InviteCache } from "./services/inviteCache.js";
import { InviteTracker } from "./services/inviteTracker.js";
import { errorEmbed, successEmbed } from "./utils/embeds.js";
import { logger } from "./utils/logger.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ],
});
const database = new Database(config.databasePath);
const inviteCache = new InviteCache(database);
const tracker = new InviteTracker(client, database, inviteCache);

registerReady(client, tracker);
registerGuildMemberAdd(client, tracker);
registerGuildMemberRemove(client, tracker);
registerInviteCreate(client, inviteCache);
registerInviteDelete(client, inviteCache);

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      await handleConfirmation(interaction);
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    const command = commandMap.get(interaction.commandName);
    if (!command) {
      await interaction.reply({
        embeds: [errorEmbed("Unknown Command", "This command is no longer available.")],
        ephemeral: true,
      });
      return;
    }
    await command.execute(interaction, { client, database, tracker });
  } catch (error) {
    logger.error(
      { err: error, interactionId: interaction.id },
      "Interaction handling failed",
    );
    const payload = {
      embeds: [
        errorEmbed(
          "Something Went Wrong",
          "The request could not be completed. Check the bot logs for details.",
        ),
      ],
      ephemeral: true,
    };
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch((followUpError: unknown) => {
          logger.error({ err: followUpError }, "Failed to send interaction error");
        });
      } else {
        await interaction.reply(payload).catch((replyError: unknown) => {
          logger.error({ err: replyError }, "Failed to send interaction error");
        });
      }
    }
  }
});

async function handleConfirmation(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(":");
  const action = parts[0];
  if (action === "cancel-reset") {
    if (parts[1] !== interaction.user.id) {
      await interaction.reply({
        embeds: [errorEmbed("Not Your Confirmation", "Only the administrator who started this request can cancel it.")],
        ephemeral: true,
      });
      return;
    }
    await interaction.update({
      embeds: [successEmbed("Reset Cancelled", "No invite statistics were changed.")],
      components: [],
    });
    return;
  }

  if (action !== "confirm-reset-user" && action !== "confirm-reset-all") return;
  const guildId = parts[1];
  const requesterId = action === "confirm-reset-user" ? parts[3] : parts[2];
  if (
    !guildId ||
    interaction.guildId !== guildId ||
    interaction.user.id !== requesterId ||
    !interaction.guild ||
    !(
      interaction.guild.ownerId === interaction.user.id ||
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    )
  ) {
    await interaction.reply({
      embeds: [errorEmbed("Not Authorized", "Only the requesting server administrator can confirm this reset.")],
      ephemeral: true,
    });
    return;
  }

  if (action === "confirm-reset-user") {
    const userId = parts[2];
    if (!userId) return;
    database.resetUser(guildId, userId);
    await interaction.update({
      embeds: [successEmbed("Invite Statistics Reset", `All invite statistics for <@${userId}> have been reset.`)],
      components: [],
    });
  } else {
    database.resetAll(guildId);
    await interaction.update({
      embeds: [successEmbed("Competition Reset", "All invite competition data for this server has been reset.")],
      components: [],
    });
  }
}

client.on("error", (error) => {
  logger.error({ err: error }, "Discord client error");
});

process.on("SIGINT", () => {
  logger.info("Shutting down");
  database.close();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down");
  database.close();
  client.destroy();
  process.exit(0);
});

void client.login(config.botToken).catch((error) => {
  logger.fatal({ err: error }, "Discord login failed");
  database.close();
  process.exit(1);
});

export { client, database, inviteCache, tracker };