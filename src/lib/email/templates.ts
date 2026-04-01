import { formatClockTime, formatDateLabel, getTaskTypeLabel } from "@/lib/daystack";
import type { TaskRecord } from "@/types/daystack";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderBrandMark() {
  return `
    <svg width="34" height="34" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="mail-left" x1="9" y1="35" x2="48" y2="92" gradientUnits="userSpaceOnUse">
          <stop stop-color="#26C3E8" />
          <stop offset="1" stop-color="#1BA8DC" />
        </linearGradient>
        <linearGradient id="mail-middle" x1="40" y1="24" x2="86" y2="112" gradientUnits="userSpaceOnUse">
          <stop stop-color="#1E9AD6" />
          <stop offset="1" stop-color="#1787C8" />
        </linearGradient>
        <linearGradient id="mail-right" x1="82" y1="12" x2="122" y2="107" gradientUnits="userSpaceOnUse">
          <stop stop-color="#6F2CFF" />
          <stop offset="1" stop-color="#4F17DA" />
        </linearGradient>
      </defs>
      <path d="M15.856 41.699C12.163 39.191 7 41.837 7 46.301V78.004C7 86.692 11.371 94.796 18.632 99.577L44.286 116.467V57.91C44.286 51.829 41.27 46.144 36.233 42.735L15.856 28.95V41.699Z" fill="url(#mail-left)" />
      <path d="M46.714 24.037C46.714 18.018 53.608 14.568 58.45 18.174L82.267 35.907C89.305 41.15 93.429 49.41 93.429 58.187V105.227C93.429 111.312 86.525 114.757 81.686 111.141L57.869 93.348C50.838 88.094 46.714 79.831 46.714 71.058V24.037Z" fill="url(#mail-middle)" />
      <path d="M102.718 16.745C97.876 13.139 90.982 16.589 90.982 22.608V114.081L109.37 101.988C116.63 97.211 121 89.104 121 80.415V48.653C121 39.876 116.876 31.616 109.839 26.373L102.718 21.072V16.745Z" fill="url(#mail-right)" />
    </svg>
  `;
}

function renderTaskCard(task: Pick<TaskRecord, "meeting_link" | "task_date" | "task_type" | "title" | "start_time" | "end_time">) {
  const rows = [
    {
      label: "Block",
      value: escapeHtml(task.title),
    },
    {
      label: "Date",
      value: escapeHtml(formatDateLabel(task.task_date)),
    },
    {
      label: "Time",
      value: escapeHtml(`${formatClockTime(task.start_time)} to ${formatClockTime(task.end_time)}`),
    },
    {
      label: "Type",
      value: escapeHtml(getTaskTypeLabel(task.task_type)),
    },
  ];

  if (task.task_type === "meeting" && task.meeting_link) {
    rows.push({
      label: "Meeting link",
      value: `<a href="${task.meeting_link}" style="color:#1496e8;text-decoration:none;">${escapeHtml(task.meeting_link)}</a>`,
    });
  }

  return `
    <div style="border:1px solid #dbe3ed;border-radius:22px;background:#ffffff;padding:20px 22px;">
      ${rows
        .map(
          (row) => `
            <div style="padding:${row.label === "Block" ? "0 0 14px" : "14px 0"};${row.label === "Block" ? "border-bottom:1px solid #edf2f7;" : ""}">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;font-weight:700;">${row.label}</div>
              <div style="margin-top:6px;font-size:15px;line-height:1.65;color:#131a24;font-weight:${row.label === "Block" ? "700" : "500"};">${row.value}</div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEmailLayout({
  actionLabel,
  actionUrl,
  eyebrow,
  intro,
  summary,
  title,
}: {
  actionLabel: string;
  actionUrl: string;
  eyebrow: string;
  intro: string;
  summary: string;
  title: string;
}) {
  return `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:0;background:#f7f9fc;font-family:Inter,Arial,sans-serif;color:#131a24;">
        <div style="margin:0 auto;max-width:640px;padding:32px 18px;">
          <div style="border:1px solid rgba(255,255,255,0.85);border-radius:32px;background:linear-gradient(180deg,#ffffff 0%,#f4f8fc 100%);box-shadow:0 24px 70px rgba(15,23,42,0.08);overflow:hidden;">
            <div style="padding:28px 28px 18px;border-bottom:1px solid #edf2f7;">
              <div style="display:flex;align-items:center;gap:12px;">
                ${renderBrandMark()}
                <div style="font-family:Sora,Inter,Arial,sans-serif;font-size:28px;line-height:1;font-weight:700;letter-spacing:-0.06em;color:#131a24;">DayStack</div>
              </div>
              <div style="margin-top:22px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6b7280;font-weight:700;">${escapeHtml(eyebrow)}</div>
              <h1 style="margin:12px 0 0;font-family:Sora,Inter,Arial,sans-serif;font-size:34px;line-height:1.05;letter-spacing:-0.06em;color:#131a24;">${escapeHtml(title)}</h1>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.8;color:#586272;">${escapeHtml(intro)}</p>
            </div>
            <div style="padding:24px 28px 0;">
              ${summary}
            </div>
            <div style="padding:26px 28px 28px;">
              <a href="${actionUrl}" style="display:inline-block;border-radius:999px;background:linear-gradient(135deg,#18beef 0%,#6d28f0 100%);padding:14px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
                ${escapeHtml(actionLabel)}
              </a>
              <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#6b7280;">DayStack sent this email because the relevant notification setting is turned on for your account.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function renderTaskReminderEmail({
  appUrl,
  leadMinutes,
  recipientName,
  task,
}: {
  appUrl: string;
  leadMinutes: number;
  recipientName: string;
  task: Pick<TaskRecord, "meeting_link" | "task_date" | "task_type" | "title" | "start_time" | "end_time">;
}) {
  const friendlyName = recipientName.trim().length > 0 ? recipientName.trim() : "there";
  const title =
    leadMinutes === 0
      ? "Your block is starting now."
      : `${task.title} starts in ${leadMinutes} minute${leadMinutes === 1 ? "" : "s"}.`;
  const intro =
    leadMinutes === 0
      ? `Hi ${friendlyName}, this is your DayStack reminder that the next block starts now.`
      : `Hi ${friendlyName}, this is your DayStack reminder before the next scheduled block begins.`;

  return {
    subject:
      leadMinutes === 0
        ? `DayStack: ${task.title} is starting now`
        : `DayStack: ${task.title} starts in ${leadMinutes} minute${leadMinutes === 1 ? "" : "s"}`,
    html: renderEmailLayout({
      actionLabel: "Open DayStack",
      actionUrl: appUrl,
      eyebrow: "Block reminder",
      intro,
      summary: renderTaskCard(task),
      title,
    }),
    text: [
      `DayStack reminder`,
      ``,
      intro,
      ``,
      `Block: ${task.title}`,
      `Date: ${formatDateLabel(task.task_date)}`,
      `Time: ${formatClockTime(task.start_time)} to ${formatClockTime(task.end_time)}`,
      `Type: ${getTaskTypeLabel(task.task_type)}`,
      task.task_type === "meeting" && task.meeting_link ? `Meeting link: ${task.meeting_link}` : null,
      ``,
      `Open DayStack: ${appUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function renderMeetingMentionEmail({
  actorName,
  appUrl,
  recipientName,
  task,
}: {
  actorName: string;
  appUrl: string;
  recipientName: string;
  task: Pick<TaskRecord, "meeting_link" | "task_date" | "task_type" | "title" | "start_time" | "end_time">;
}) {
  const friendlyName = recipientName.trim().length > 0 ? recipientName.trim() : "there";
  const intro = `Hi ${friendlyName}, ${actorName} tagged you in a meeting block on DayStack.`;

  return {
    subject: `DayStack: ${actorName} tagged you in ${task.title}`,
    html: renderEmailLayout({
      actionLabel: "Review meeting",
      actionUrl: appUrl,
      eyebrow: "Meeting mention",
      intro,
      summary: renderTaskCard(task),
      title: "You were tagged in a meeting block.",
    }),
    text: [
      `DayStack meeting mention`,
      ``,
      intro,
      ``,
      `Meeting: ${task.title}`,
      `Date: ${formatDateLabel(task.task_date)}`,
      `Time: ${formatClockTime(task.start_time)} to ${formatClockTime(task.end_time)}`,
      task.meeting_link ? `Meeting link: ${task.meeting_link}` : null,
      ``,
      `Review it here: ${appUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
