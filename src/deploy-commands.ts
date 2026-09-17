import {
  REST,
  Routes,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";
import { commands } from "./commands/index.js";
import { config } from "./config/config.js";
import { logger } from "./utils/logger.js";

const body = commands.map((command) =>
  command.data.toJSON(),
) as RESTPostAPIApplicationCommandsJSONBody[];
const rest = new REST({ version: "10" }).setToken(config.botToken);

try {
  logger.info(
    { guildId: config.guildId, commandCount: body.length },
    "Deploying guild slash commands",
  );
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body },
  );
  logger.info("Guild slash commands deployed");
} catch (error) {
  logger.fatal({ err: error }, "Slash command deployment failed");
  process.exitCode = 1;
}