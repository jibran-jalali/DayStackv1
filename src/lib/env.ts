export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

export interface OneSignalEnv {
  appId: string;
}

const DEFAULT_SUPABASE_URL = "https://lvfclrfqzjepuhiqrfqt.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_91UCrF9eEE4rhyQmAOgesA_f2xxqekr";

export function getSupabaseEnv(): SupabaseEnv | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    DEFAULT_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return {
    url,
    publishableKey,
  };
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseEnv());
}

export function getOneSignalEnv(): OneSignalEnv | null {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim();

  if (!appId) {
    return null;
  }

  return {
    appId,
  };
}

export function isOneSignalConfigured() {
  return Boolean(getOneSignalEnv());
}
