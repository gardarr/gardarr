import { Navigate } from "react-router-dom";
import { useSetup } from "@/contexts/setup-hooks";
import DashboardPage from "@/Dashboard";

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
