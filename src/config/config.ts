import "dotenv/config";
import path from "node:path";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  botToken: required("BOT_TOKEN"),
  clientId: required("CLIENT_ID"),
  guildId: required("GUILD_ID"),
  inviteLogChannelId: process.env.INVITE_LOG_CHANNEL_ID?.trim() || null,
  databasePath: path.resolve(
    process.env.DATABASE_PATH?.trim() || "./data/invites.sqlite",
  ),
  logLevel: process.env.LOG_LEVEL?.trim() || "info",
  nodeEnv: process.env.NODE_ENV?.trim() || "development",
  minimumAccountAgeDays: 7,
} as const;