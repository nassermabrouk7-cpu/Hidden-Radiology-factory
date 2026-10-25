export function getInstagramBusinessAccountId(): string | null {
  const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
  const legacyUserId = process.env.INSTAGRAM_USER_ID?.trim();
  if (businessAccountId && legacyUserId && businessAccountId !== legacyUserId) return null;
  const id = businessAccountId || legacyUserId;
  return id && /^\d{10,20}$/.test(id) ? id : null;
}
