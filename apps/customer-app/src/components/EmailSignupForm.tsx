// src/components/EmailSignupForm.tsx
import React, { useState } from "react";
import { submitEmail } from "@/utils/emailSignup";

type Props = {
  defaultSource?: string;
  onSuccess?: () => void;
};

export default function EmailSignupForm({ defaultSource = "hero", onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      const res = await submitEmail(trimmed, defaultSource);

      if (res.success === false) {
        // Show detailed error from the helper (useful for debugging)
        const err = res.error;
        let msg = "Signup failed.";
        if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
          msg = err.message;
        } else if (typeof err === "string") {
          msg = err;
        } else if (err) {
          msg = JSON.stringify(err);
        }

        // Friendly handling for duplicate / unique constraint
        if (/duplicate|23505|unique/i.test(msg)) {
          setMessage("You're already on the list - thank you!");
          // Treat duplicate as success UX-wise
          if (onSuccess) setTimeout(() => onSuccess(), 700);
        } else {
          setError(msg);
        }
        return;
      }

      // Success
      setMessage("Thanks - you're on the list!");
      setEmail("");
      if (onSuccess) setTimeout(() => onSuccess(), 700);
    } catch (err: any) {
      // Fallback unexpected error
      const msg = err?.message || String(err) || "Signup failed. Please try again later.";
      setError(msg);
      // eslint-disable-next-line no-console
      console.debug("submitEmail unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div>
        <label className="sr-only" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full px-4 py-3 rounded border outline-none focus:ring-2 focus:ring-primary"
          aria-invalid={!!error}
          aria-describedby={error ? "email-error" : undefined}
          disabled={loading}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-60"
        >
          {loading ? "Joining…" : "Join Waitlist"}
        </button>
      </div>

      {message && <p className="text-sm text-green-600" role="status">{message}</p>}
      {error && (
        <p id="email-error" className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
