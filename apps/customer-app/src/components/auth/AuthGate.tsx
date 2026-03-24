import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/SupabaseAuthContext";

export default function AuthGate({ children }: { children: React.ReactNode }) {

  const { user, loading, needsOnboarding, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showEscapeHatch, setShowEscapeHatch] = useState(false);

  // Show "Continue Anyway" button after 6s of loading
  useEffect(() => {
    if (!loading) {
      setShowEscapeHatch(false);
      return;
    }
    const timer = setTimeout(() => setShowEscapeHatch(true), 6000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {

    if (loading) return;

    const publicPaths = [
      "/",
      "/signin",
      "/signup",
      "/auth/login",
      "/auth/otp",
      "/auth/callback",
      "/auth/signout",
      "/auth/create-account",
      "/auth/verify-email-callback",
    ];
    const isPublicPath = publicPaths.some(
      (p) => location.pathname === p || location.pathname.startsWith(p + "/")
    );

    // Not logged in — allow public paths, redirect from protected ones
    if (!user) {
      if (!isPublicPath) {
        navigate("/auth/login", { replace: true });
      }
      return;
    }

    // Logged in but onboarding not complete
    if (user && needsOnboarding) {
      const targetPath = "/auth/create-account";

      // Already on the onboarding page — stay
      if (location.pathname === targetPath) return;

      // Came from an active auth flow (OTP verified, callback, etc.) — send to onboarding
      if (location.pathname.startsWith("/auth/")) {
        navigate(targetPath, { replace: true });
        return;
      }

      // If they somehow landed on a non-auth path while needing onboarding, redirect them to create-account
      navigate(targetPath, { replace: true });
      return;
    }

    // Logged in + profile complete — redirect away from pure auth/landing pages
    if (user && !needsOnboarding) {
      const loginOnlyPaths = ["/auth/login", "/auth/otp", "/auth/callback", "/signin", "/signup", "/"];
      if (loginOnlyPaths.includes(location.pathname)) {
        navigate("/home", { replace: true });
      }
    }

  }, [user, loading, needsOnboarding, location.pathname]);

  // ── Block ALL rendering while auth is resolving ──────────────────────────
  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "#000",
          zIndex: 9999,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid rgba(242,84,109,0.2)",
            borderTopColor: "#f2546d",
            animation: "spin 0.7s linear infinite",
          }}
        />

        {showEscapeHatch && (
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px",
              borderRadius: 12,
              background: "rgba(242,84,109,0.15)",
              border: "1px solid rgba(242,84,109,0.4)",
              color: "#f2546d",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Taking too long? Tap to refresh
          </button>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}