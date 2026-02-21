// src/components/FooterSignupInline.tsx
import React, { useState } from "react";
import { submitEmail } from "../utils/emailSignup"; // relative import to utils

export default function FooterSignupInline() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFooterSignup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setMessage(null);
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      const res = await submitEmail(trimmed, "footer");

      if (res.success === false) {
        console.error("Footer signup error:", res.error);
        let errMsg = "Signup failed";
        if (res.error && typeof res.error === "object" && "message" in res.error && typeof res.error.message === "string") {
          errMsg = res.error.message;
        } else if (typeof res.error === "string") {
          errMsg = res.error;
        } else if (res.error) {
          errMsg = JSON.stringify(res.error);
        }
        if (/duplicate|23505|unique/i.test(errMsg)) {
          setMessage("You're already on the list - thank you!");
        } else {
          setError(errMsg);
        }
        return;
      }

      setMessage("Thanks - you're on the list!");
      setEmail("");
    } catch (err: any) {
      console.error("Unexpected footer signup error:", err);
      setError(err?.message || "Signup failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleFooterSignup} className="flex flex-col sm:flex-row items-center gap-3 justify-center w-full max-w-xl mx-auto mt-6">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full sm:flex-1 px-4 py-3 rounded-full shadow border border-border focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
        disabled={loading}
        aria-label="Email address"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-3 rounded-full bg-white/90 dark:bg-slate-100 text-green-600 font-semibold shadow hover:opacity-95 dark:text-emerald-700"
      >
        {loading ? "Joining…" : "Join the Early Bird List"}
      </button>

      {message && <div className="text-green-600 mt-2 sm:mt-0 sm:ml-4">{message}</div>}
      {error && <div className="text-red-600 mt-2 sm:mt-0 sm:ml-4">{error}</div>}
    </form>
  );
}
