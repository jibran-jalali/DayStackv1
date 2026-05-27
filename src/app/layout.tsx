import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";

import { TouchFeedback } from "@/components/app/touch-feedback";

import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1496E8",
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://daystack.qzz.io"),
  applicationName: "DayStack",
  title: {
    default: "DayStack",
    template: "%s | DayStack",
  },
  description:
    "DayStack is a timeline-based daily execution planner for building structure, momentum, and streaks around your day.",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "DayStack",
    description:
      "A timeline-based daily execution planner for building structure, momentum, and streaks around your day.",
    url: "https://daystack.qzz.io/",
    siteName: "DayStack",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "DayStack",
    description:
      "A timeline-based daily execution planner for building structure, momentum, and streaks around your day.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DayStack",
  },
  icons: {
    icon: [
      {
        url: "/icon.png",
        type: "image/png",
      },
    ],
    shortcut: [
      {
        url: "/favicon.ico",
        type: "image/x-icon",
      },
    ],
    apple: [
      {
        url: "/apple-icon.png",
        type: "image/png",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sora.variable} bg-background text-foreground antialiased`}>
        <TouchFeedback />
        {children}
      </body>
    </html>
  );
}
