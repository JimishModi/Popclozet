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

    // not logged in — send to login
    if (!user) {
      navigate("/signin", { replace: true });
      return;
    }

    // logged in but new user needs onboarding
    if (user && needsOnboarding) {
      if (location.pathname !== "/auth/create-account") {
        navigate("/auth/create-account", { replace: true });
      }
      return;
    }

    // logged in + profile done — redirect away from auth pages
    if (user && !needsOnboarding) {
      if (location.pathname.startsWith("/auth") || location.pathname === "/signin") {
        navigate("/home", { replace: true });
      }
    }

  }, [user, loading, needsOnboarding, location.pathname]);

  // ── Block ALL rendering while auth is resolving ──────────────────────────
  // This prevents any route (including NotFound) from flashing before we know
  // who the user is.
  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          zIndex: 9999,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid rgba(255,77,109,0.2)",
            borderTopColor: "#ff4d6d",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}