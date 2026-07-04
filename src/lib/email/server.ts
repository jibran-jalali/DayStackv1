import "server-only";

import nodemailer from "nodemailer";

import { getEmailServerEnv } from "@/lib/env";
import { renderMeetingMentionEmail, renderTaskReminderEmail } from "@/lib/email/templates";
import { deriveDisplayName } from "@/lib/daystack";
import type { TaskRecord, UserRecord } from "@/types/daystack";

type ReminderTaskSnapshot = Pick<
  TaskRecord,
  "end_time" | "meeting_link" | "start_time" | "task_date" | "task_type" | "title"
>;

declare global {
  var __daystack_mailer:
    | nodemailer.Transporter
    | null
    | undefined;
}

function getTransporter() {
  const env = getEmailServerEnv();

  if (!env) {
    return null;
  }

  if (globalThis.__daystack_mailer) {
    return globalThis.__daystack_mailer;
  }

  const transporter = nodemailer.createTransport({
    auth: {
      pass: env.appPassword,
      user: env.user,
    },
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
  });

  globalThis.__daystack_mailer = transporter;
  return transporter;
}

export function isEmailServerConfigured() {
  return Boolean(getEmailServerEnv());
}

async function sendEmail({
  html,
  subject,
  text,
  to,
}: {
  html: string;
  subject: string;
  text: string;
  to: string;
}) {
  const env = getEmailServerEnv();
  const transporter = getTransporter();

  if (!env || !transporter) {
    throw new Error("Email delivery is not configured on the server.");
  }

  await transporter.sendMail({
    from: `"${env.fromName}" <${env.user}>`,
    html,
    subject,
    text,
    to,
  });
}

export async function sendTaskReminderEmail({
  appUrl,
  leadMinutes,
  recipient,
  task,
}: {
  appUrl: string;
  leadMinutes: number;
  recipient: Pick<UserRecord, "email" | "full_name">;
  task: ReminderTaskSnapshot;
}) {
  const message = renderTaskReminderEmail({
    appUrl,
    leadMinutes,
    recipientName: deriveDisplayName(recipient.full_name, recipient.email),
    task,
  });

  await sendEmail({
    ...message,
    to: recipient.email,
  });
}

export async function sendMeetingMentionEmail({
  actor,
  appUrl,
  recipient,
  task,
}: {
  actor: Pick<UserRecord, "email" | "full_name">;
  appUrl: string;
  recipient: Pick<UserRecord, "email" | "full_name">;
  task: ReminderTaskSnapshot;
}) {
  const message = renderMeetingMentionEmail({
    actorName: deriveDisplayName(actor.full_name, actor.email),
    appUrl,
    recipientName: deriveDisplayName(recipient.full_name, recipient.email),
    task,
  });

  await sendEmail({
    ...message,
    to: recipient.email,
  });
}
