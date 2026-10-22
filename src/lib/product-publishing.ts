export type ChannelPublishRecord = {
  success: boolean;
  externalId?: string;
  error?: string;
};

export type ChannelPublishRecords = Record<string, ChannelPublishRecord>;

export function getChannelsToPublish(
  enabledChannels: string[],
  priorResults: ChannelPublishRecords,
): string[] {
  return enabledChannels.filter((channel) => !priorResults[channel]?.success);
}

export function getCampaignStatus(
  enabledChannels: string[],
  results: ChannelPublishRecords,
): "ready" | "active" | "completed" {
  if (enabledChannels.length > 0 && enabledChannels.every((channel) => results[channel]?.success)) {
    return "completed";
  }
  if (enabledChannels.some((channel) => results[channel]?.success)) return "active";
  return "ready";
}

export function getRetryMetadata(
  metadata: Record<string, unknown> | null | undefined,
): { attempts: number; results: ChannelPublishRecords } {
  const current = metadata || {};
  const rawAttempts = Number(current.attempts);
  const attempts = Number.isSafeInteger(rawAttempts) && rawAttempts >= 0 ? rawAttempts : 0;
  const rawResults = current.channel_results;
  const results = rawResults && typeof rawResults === "object" && !Array.isArray(rawResults)
    ? rawResults as ChannelPublishRecords
    : {};
  return { attempts, results };
}

export function canRetryCampaign(
  metadata: Record<string, unknown> | null | undefined,
  maxAttempts: number,
): boolean {
  const current = metadata || {};
  const { attempts, results } = getRetryMetadata(current);
  return current.retry_exhausted !== true && attempts < maxAttempts && (
    Object.keys(results).length === 0 || Object.values(results).some((result) => !result?.success)
  );
}

export function countsTowardProductCooldown(
  status: unknown,
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (status !== "active" && status !== "completed") return false;
  const { results } = getRetryMetadata(metadata);
  return Object.values(results).some((result) => result?.success === true);
}

export function makeSalesCaption(product: {
  title_ar?: string | null;
  title_en?: string | null;
  description_ar?: string | null;
  description_en?: string | null;
  price: number;
}, buyUrl: string): string {
  const title = product.title_en?.trim() || product.title_ar?.trim() || "Radiology resource";
  const description = product.description_en?.trim() || product.description_ar?.trim() || "A practical radiology reference.";
  return `${title}\n\n${description}\n\nPrice: $${product.price.toFixed(2)}\n\nBuy: ${buyUrl}`;
}
