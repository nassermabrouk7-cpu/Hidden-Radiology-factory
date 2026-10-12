/** Only expose public cover assets from this project's Supabase covers bucket. */
export function getTrustedProductCoverUrl(value: unknown, supabaseUrl: string | undefined): string | null {
  if (typeof value !== "string" || !supabaseUrl) return null;
  try {
    const cover = new URL(value);
    const storage = new URL(supabaseUrl);
    if (
      cover.protocol !== "https:" ||
      cover.origin !== storage.origin ||
      !cover.pathname.startsWith("/storage/v1/object/public/covers/") ||
      cover.username || cover.password || cover.search || cover.hash
    ) return null;
    return cover.toString();
  } catch {
    return null;
  }
}
