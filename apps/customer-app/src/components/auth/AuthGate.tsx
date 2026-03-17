import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/SupabaseAuthContext";

export default function AuthGate({ children }: { children: React.ReactNode }) {

  const { user, loading, needsOnboarding } = useAuth();
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

    const publicRoutes = [
      "/",
      "/signin",
      "/signup",
      "/auth/login",
      "/auth/callback",
      "/auth/signout"
    ];

    // allow public pages
    if (!user && publicRoutes.includes(location.pathname)) {
      return;
    }

    // not logged in — send to login
    if (!user) {
      if (location.pathname.startsWith('/home') || location.pathname === '/auth/create-account') {
        navigate("/auth/login", { replace: true });
      }
      return;
    }

    // logged in but new user needs onboarding
    if (user && needsOnboarding) {
      const provider = user.app_metadata?.provider;
      const targetPath = provider === 'google' ? "/auth/google-onboarding" : "/auth/create-account";
      
      if (location.pathname !== targetPath) {
        navigate(targetPath, { replace: true });
      }
      return;
    }

    // logged in + profile done — redirect away from auth pages
    if (user && !needsOnboarding) {
      if ((location.pathname.startsWith("/auth") && location.pathname !== "/auth/signout") || location.pathname === "signin") {
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
            border: "3px solid rgba(255,77,109,0.2)",
            borderTopColor: "#ff4d6d",
            animation: "spin 0.7s linear infinite",
          }}
        />

        {showEscapeHatch && (
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px",
              borderRadius: 12,
              background: "rgba(255,77,109,0.15)",
              border: "1px solid rgba(255,77,109,0.4)",
              color: "#ff4d6d",
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