import { EmbedBuilder } from "discord.js";

const COLORS = {
  purple: 0x8b5cf6,
  green: 0x22c55e,
  orange: 0xf59e0b,
  red: 0xef4444,
  slate: 0x475569,
} as const;

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.green)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: "Invite Competition" });
}

export function errorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.red)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: "Invite Competition" });
}

export function inviteStatsEmbed(
  username: string,
  stats: {
    validInvites: number;
    fakeInvites: number;
    leftInvites: number;
    bonusInvites: number;
  },
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.purple)
    .setTitle("Invite Statistics")
    .setDescription(`User: ${username}`)
    .addFields(
      { name: "Valid Invites", value: String(stats.validInvites), inline: true },
      { name: "Fake Invites", value: String(stats.fakeInvites), inline: true },
      { name: "Left Invites", value: String(stats.leftInvites), inline: true },
      { name: "Bonus Invites", value: String(stats.bonusInvites), inline: true },
      {
        name: "Total Competition Score",
        value: String(stats.validInvites + stats.bonusInvites),
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter({ text: "Valid + Bonus invites count toward the competition" });
}

export function leaderboardEmbed(
  rows: Array<{ position: number; username: string; score: number }>,
): EmbedBuilder {
  const description =
    rows.length === 0
      ? "No invite activity has been recorded yet."
      : rows
          .map(
            (row) =>
              `**${row.position}.** ${row.username} — **${row.score}** Invites`,
          )
          .join("\n");

  return new EmbedBuilder()
    .setColor(COLORS.purple)
    .setTitle("Invite Leaderboard")
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: "Ranking: Valid Invites + Bonus Invites" });
}

export function inviteLogEmbed(input: {
  title: string;
  member: string;
  inviter: string;
  code: string;
  accountAgeDays: number;
  status: string;
  statusColor: "valid" | "fake" | "left";
  inviterValidInvites?: number;
}): EmbedBuilder {
  const color =
    input.statusColor === "valid"
      ? COLORS.green
      : input.statusColor === "fake"
        ? COLORS.orange
        : COLORS.red;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(input.title)
    .addFields(
      { name: "Member", value: input.member, inline: true },
      { name: "Invited By", value: input.inviter, inline: true },
      { name: "Invite Code", value: input.code, inline: true },
      {
        name: "Account Age",
        value: `${input.accountAgeDays} day${input.accountAgeDays === 1 ? "" : "s"}`,
        inline: true,
      },
      { name: "Status", value: input.status, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: "Invite Competition" });

  if (input.inviterValidInvites !== undefined) {
    embed.addFields({
      name: "Current Valid Invites",
      value: String(input.inviterValidInvites),
      inline: true,
    });
  }

  return embed;
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.slate)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: "Invite Competition" });
}