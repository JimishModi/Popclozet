import { supabase } from "@popclozet/api-client";

export interface SignupCountResult {
    count: number;
    error?: string;
}

/**
 * Fetches the total count of email signups from Supabase.
 * First attempts to use the secure get_signup_count() function,
 * then falls back to direct count query if that's not available.
 */
export async function getSignupCount(): Promise<SignupCountResult> {
    try {
        // First, try using the secure database function
        const { data: functionData, error: functionError } = await supabase
            .rpc("get_signup_count");

        if (!functionError && typeof functionData === "number") {
            return { count: functionData };
        }

        // Fallback: Try direct count query (works if RLS allows it)
        const { count, error } = await supabase
            .from("email_signups")
            .select("*", { count: "exact", head: true });

        if (error) {
            console.error("Error fetching signup count:", error);
            return { count: 0, error: error.message };
        }

        return { count: count ?? 0 };
    } catch (err) {
        console.error("Unexpected error fetching signup count:", err);
        return { count: 0, error: "Network error" };
    }
}
