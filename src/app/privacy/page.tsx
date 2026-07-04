import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "DayStack privacy policy, including Google Calendar connection details.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate="May 29, 2026"
      description="This Privacy Policy explains what DayStack collects, how we use it, and how Google Calendar data is handled when you connect your calendar."
      sections={[
        {
          title: "Information We Collect",
          body: [
            "DayStack collects account information such as your name, email address, password hash, app preferences, task blocks, meeting details, friend connections, notifications, reminders, and usage data needed to operate the planner.",
            "If you enable push notifications, DayStack stores browser push subscription data so reminders can be delivered to your device.",
          ],
        },
        {
          title: "Google Calendar Data",
          body: [
            "If you connect Google Calendar, DayStack requests permission to create, update, and delete calendar events for your DayStack blocks using the Google Calendar events scope.",
            "DayStack stores encrypted Google OAuth tokens so your future DayStack blocks can continue syncing to your Google Calendar. DayStack also stores the Google event IDs linked to your DayStack tasks so updates and deletions remain accurate.",
            "DayStack does not sell Google user data, does not use Google Calendar data for advertising, and does not transfer Google Calendar data to third parties except as needed to provide the calendar sync feature or comply with law.",
          ],
        },
        {
          title: "How We Use Information",
          body: [
            "We use your information to provide planning, reminders, notifications, friend-based meeting workflows, account access, security, and optional Google Calendar sync.",
            "When Google Calendar is connected, future DayStack blocks you create or change may be reflected as events in your selected Google Calendar.",
          ],
        },
        {
          title: "Data Storage And Security",
          body: [
            "DayStack stores application data in a managed database. Sensitive Google OAuth tokens are encrypted before storage using server-side secrets.",
            "No online service can guarantee perfect security, but DayStack uses reasonable safeguards to protect account and calendar connection data.",
          ],
        },
        {
          title: "Your Choices",
          body: [
            "You can disconnect Google Calendar from DayStack settings. Disconnecting removes the stored Google connection and DayStack's local mapping to Google events.",
            "You can also revoke DayStack's access from your Google Account permissions page at any time.",
          ],
        },
        {
          title: "Contact",
          body: [
            "For privacy questions or data requests, contact the DayStack operator through the support email listed on the Google OAuth consent screen.",
          ],
        },
      ]}
    />
  );
}
