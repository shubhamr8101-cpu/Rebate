import type { CommandModule } from "../types.js";
import { addInvitesCommand } from "./addinvites.js";
import { invitedByCommand } from "./invitedby.js";
import { inviteHistoryCommand } from "./invitehistory.js";
import { invitesCommand } from "./invites.js";
import { leaderboardCommand } from "./leaderboard.js";
import { removeInvitesCommand } from "./removeinvites.js";
import { resetAllInvitesCommand } from "./resetallinvites.js";
import { resetInvitesCommand } from "./resetinvites.js";

export const commands: CommandModule[] = [
  invitesCommand,
  leaderboardCommand,
  invitedByCommand,
  inviteHistoryCommand,
  addInvitesCommand,
  removeInvitesCommand,
  resetInvitesCommand,
  resetAllInvitesCommand,
];

export const commandMap = new Map(
  commands.map((command) => [command.data.name, command]),
);