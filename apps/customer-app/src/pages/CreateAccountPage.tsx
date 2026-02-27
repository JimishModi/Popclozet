import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/context/SupabaseAuthContext";
import logoImage from "@/logo/logo.png";

type Gender = "men" | "women" | "other";

interface LocationState {
  email?: string;
  name?: string;
}

export default function CreateAccountPage() {

  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const { updateProfile, user } = useAuth();

  const [name, setName] = useState(state?.name || "");
  const [email, setEmail] = useState(state?.email || "");

  useEffect(() => {
    // If no state provided (OAuth redirect), prefill from authenticated user
    if (user) {
      if (!state?.email && user.email) setEmail(user.email);
      if (!state?.name) {
        const metaName = (user as any).user_metadata?.full_name || (user as any).user_metadata?.name;
        if (metaName) setName(metaName);
      }
    }
  }, [user, state]);
  const [gender, setGender] = useState<Gender | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isValid =
    name.trim().length > 1 &&
    email.trim().length > 3 &&
    gender !== null &&
    acceptedTerms;

  const handleSubmit = async () => {
    if (!isValid || isLoading) return;

    setIsLoading(true);

    try {
      // ONLY THIS. NO DIRECT SUPABASE CALL.
      await updateProfile({
        full_name: name,
        email: email,
        gender: gender,
        onboarding_completed: true,
      });

      navigate("/home", { replace: true });

    } catch (err) {
      console.error(err);
      alert("Could not create account.");
      setIsLoading(false);
    }
  };

  return (
    <MobileShell className="bg-black text-white">
      <div className="flex flex-col min-h-screen px-6 py-8">

        <div className="flex justify-center mb-10">
          <img src={logoImage} alt="PopClozet" className="h-8 w-auto" />
        </div>

        <h1 className="text-xl font-bold mb-8">Create Account</h1>

        <div className="space-y-6 flex-1">

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-900 rounded-xl border border-zinc-800 px-4 py-3"
            placeholder="Enter your name"
          />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 rounded-xl border border-zinc-800 px-4 py-3"
            placeholder="Enter your email"
          />

          <div className="flex gap-3">
            {(["men","women","other"] as const).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`flex-1 py-3 rounded-xl ${
                  gender === g
                    ? "bg-pink-500 text-white"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={() => setAcceptedTerms(!acceptedTerms)}
            />
            Accept Terms
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="w-full py-4 rounded-2xl bg-pink-500 mt-8 disabled:opacity-40"
        >
          {isLoading ? "Creating..." : "Done"}
        </button>
      </div>
    </MobileShell>
  );
}