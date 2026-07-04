import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "DayStack terms of service.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      effectiveDate="May 29, 2026"
      description="These Terms describe the rules for using DayStack, including optional Google Calendar sync."
      sections={[
        {
          title: "Use Of DayStack",
          body: [
            "DayStack is a planning and productivity web application. You are responsible for the tasks, meeting details, and other content you create in the app.",
            "You agree not to misuse DayStack, interfere with the service, attempt unauthorized access, or use the app for unlawful activity.",
          ],
        },
        {
          title: "Accounts",
          body: [
            "You are responsible for keeping your account credentials secure and for activity that occurs under your account.",
            "DayStack may restrict or disable access if an account is used in a way that harms the service or other users.",
          ],
        },
        {
          title: "Google Calendar Sync",
          body: [
            "Google Calendar sync is optional. If you connect Google Calendar, DayStack may create, update, and delete Google Calendar events that correspond to your DayStack blocks.",
            "You can disconnect Google Calendar from DayStack settings or revoke access in your Google Account at any time.",
          ],
        },
        {
          title: "Service Availability",
          body: [
            "DayStack is provided on an as-is and as-available basis. We aim to keep the app reliable, but we do not guarantee uninterrupted or error-free operation.",
            "Reminder, notification, email, and calendar sync features may depend on third-party services and device settings outside DayStack's control.",
          ],
        },
        {
          title: "Limitation Of Liability",
          body: [
            "DayStack is not responsible for missed tasks, missed reminders, calendar conflicts, data loss, or indirect damages arising from use of the service to the extent permitted by law.",
          ],
        },
        {
          title: "Changes",
          body: [
            "We may update these Terms as DayStack changes. Continued use of DayStack after updates means you accept the revised Terms.",
          ],
        },
      ]}
    />
  );
}
