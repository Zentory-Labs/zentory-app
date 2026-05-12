import { createClient } from "@/utils/supabase/client";

export interface DbWhitelist {
  id: string;
  email: string;
  source: string;
  created_at: string;
}

/** Insert a new email into the whitelist table. */
export async function insertWhitelistEmail(
  email: string,
  source = "website"
): Promise<DbWhitelist | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("whitelist")
    .insert({ email: email.toLowerCase().trim(), source })
    .select()
    .single();

  if (error) {
    console.error("[whitelist] insertWhitelistEmail:", error.message);
    return null;
  }
  return data as DbWhitelist;
}

/** Check if an email is already on the waitlist. */
export async function getWhitelistEntry(email: string): Promise<DbWhitelist | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("whitelist")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error) return null;
  return data as DbWhitelist;
}
