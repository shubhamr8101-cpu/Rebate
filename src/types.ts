import type {
  ChatInputCommandInteraction,
  Client,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";
import type { Database } from "./services/database.js";
import type { InviteTracker } from "./services/inviteTracker.js";

export type InviteStatus =
  | "valid"
  | "fake"
  | "left"
  | "rejoined"
  | "unattributed"
  | "bot";

export type CommandContext = {
  client: Client;
  database: Database;
  tracker: InviteTracker;
};

export type CommandModule = {
  data: {
    name: string;
    toJSON(): RESTPostAPIApplicationCommandsJSONBody;
  };
  execute(
    interaction: ChatInputCommandInteraction,
    context: CommandContext,
  ): Promise<void>;
};

export type InviteStats = {
  guildId: string;
  userId: string;
  totalInvites: number;
  validInvites: number;
  fakeInvites: number;
  leftInvites: number;
  bonusInvites: number;
};

export type InvitedMemberRecord = {
  guildId: string;
  memberId: string;
  inviterId: string | null;
  inviteCode: string | null;
  joinedAt: string;
  accountCreatedAt: string;
  status: InviteStatus;
  counted: boolean;
};

export type HistoryRecord = InvitedMemberRecord & {
  username: string | null;
};