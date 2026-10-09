export function normalizeMarketingSiteUrl(
  configuredUrl: string | undefined,
  environment = process.env.NODE_ENV,
) {
  if (!configuredUrl) throw new Error("MARKETING_SITE_URL must be configured before generating campaign links");

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("MARKETING_SITE_URL is invalid");
  }

  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const secureProtocol = url.protocol === "https:" || (environment !== "production" && url.protocol === "http:" && localHost);
  if (!secureProtocol || url.username || url.password || url.search || url.hash) {
    throw new Error("MARKETING_SITE_URL must be an HTTPS site URL without credentials, query, or fragment");
  }
  return url.toString().replace(/\/+$/, "");
}
