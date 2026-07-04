import { LandingPage } from "@/components/marketing/landing-page";
import { fetchLeaderboard } from "@/lib/data/leaderboard";

export const revalidate = 300;

export default async function HomePage() {
  const leaderboard = await fetchLeaderboard().catch(() => []);

  return <LandingPage leaderboard={leaderboard} />;
}
