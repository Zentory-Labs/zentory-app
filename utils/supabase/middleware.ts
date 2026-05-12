import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

async function updateUserCountry(userId: string, country: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_metadata: { country },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[updateUserCountry] failed:', err);
    }
  } catch (e) {
    console.error('[updateUserCountry] error:', e);
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Supabase not configured — skip auth middleware and continue
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Get the authenticated user and update country in app_metadata
  const country = request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry') ?? 'XX';

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const currentCountry = user.app_metadata?.country;
    // Only update if country changed or not set yet
    if (country !== 'XX' && currentCountry !== country) {
      updateUserCountry(user.id, country.toUpperCase());
    }
  }

  return supabaseResponse;
}
