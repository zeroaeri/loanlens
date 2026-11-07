export function isConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return !!(
    url &&
    key &&
    !url.includes("YOUR_PROJECT") &&
    !key.includes("YOUR_")
  );
}
