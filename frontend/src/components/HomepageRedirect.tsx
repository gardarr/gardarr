import { Navigate } from "react-router-dom";
import { useSetup } from "@/contexts/setup-hooks";
import DashboardPage from "@/Dashboard";

/**
 * Chooses and renders the appropriate homepage based on setup state.
 *
 * While setup is loading it renders nothing; if statistics are disabled it navigates to "/torrents" (replace); otherwise it renders the DashboardPage.
 *
 * @returns The element to render: `null` while loading, a `<Navigate to="/torrents" replace />` element when statistics are disabled, or the `<DashboardPage />` component when statistics are enabled.
 */
export default function HomepageRedirect() {
  const { statisticsEnabled, loading } = useSetup();

  if (loading) {
    return null;
  }

  if (!statisticsEnabled) {
    return <Navigate to="/torrents" replace />;
  }

  return <DashboardPage />;
}