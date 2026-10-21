/** Reject placeholder values and malformed IDs before they reach the Graph API. */
export function getFacebookCredentialError(
  pageId: string | undefined,
  accessToken: string | undefined,
): string | null {
  const normalizedPageId = pageId?.trim();
  const normalizedToken = accessToken?.trim();

  if (!normalizedPageId || !normalizedToken) {
    return "Facebook publisher is not configured. Missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN.";
  }

  if (!/^\d+$/.test(normalizedPageId)) {
    return "FACEBOOK_PAGE_ID must contain only the numeric Facebook Page ID. Check that it is not an App ID, token, placeholder, or combined value.";
  }

  if (
    normalizedToken.includes("|") ||
    /^\[.*\]$/.test(normalizedToken) ||
    /SENSITIVE|REDACTED/i.test(normalizedToken)
  ) {
    return "FACEBOOK_PAGE_ACCESS_TOKEN is malformed or a placeholder. Configure a valid Page access token.";
  }

  return null;
}
