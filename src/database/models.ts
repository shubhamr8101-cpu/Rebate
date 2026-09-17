import type { InviteStatus, InviteStats, InvitedMemberRecord } from "../types.js";

export type UserRow = InviteStats & {
  createdAt: string;
  updatedAt: string;
};

export type InviteCodeRow = {
  guildId: string;
  code: string;
  inviterId: string | null;
  uses: number;
  isVanity: boolean;
  lastSeenAt: string;
};

export type JoinInput = {
  guildId: string;
  memberId: string;
  inviterId: string | null;
  inviteCode: string | null;
  joinedAt: string;
  accountCreatedAt: string;
  status: InviteStatus;
  counted: boolean;
};

export type JoinResult = {
  kind: "new" | "rejoin";
  record: InvitedMemberRecord;
};