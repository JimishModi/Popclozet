import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/SupabaseAuthContext";

export default function AuthGate({ children }: { children: React.ReactNode }) {

  const { user, loading, needsOnboarding } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {

    if (loading) return;

    const publicRoutes = [
      "/",
      "/signin",
      "/signup",
      "/auth/login",
      "/auth/callback",
      "/auth/create-account",
      "/auth/otp"
    ];

    // allow public pages
    if (!user && publicRoutes.includes(location.pathname)) {
      return;
    }

    // not logged in
    if (!user) {
      navigate("/signin", { replace: true });
      return;
    }

    // logged in but new user
    if (user && needsOnboarding) {
      if (location.pathname !== "/auth/create-account") {
        navigate("/auth/create-account", { replace: true });
      }
      return;
    }

    // logged in + profile done
    if (user && !needsOnboarding) {
      if (location.pathname.startsWith("/auth") || location.pathname === "/signin") {
        navigate("/home", { replace: true });
      }
    }

  }, [user, loading, needsOnboarding, location.pathname]);

  return <>{children}</>;
}