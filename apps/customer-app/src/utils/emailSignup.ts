import { supabase } from "@popclozet/api-client";

export type SignupResult =
  | { success: true }
  | { success: false; error: string };

export async function submitEmail(
  email: string,
  source: string = "landing-page"
): Promise<SignupResult> {
  if (!email || typeof email !== "string") {
    return { success: false, error: "Email is required" };
  }

  const cleaned = email.trim().toLowerCase();

  try {
    const { error } = await supabase
      .from("email_signups")
      .insert([
        {
          email: cleaned,
          source,
        },
      ]);

    // Duplicate email (unique constraint) → treat as success
    if (error) {
      if (error.code === "23505") {
        return { success: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Supabase submit error:", err);
    return { success: false, error: "Network error" };
  }
}
