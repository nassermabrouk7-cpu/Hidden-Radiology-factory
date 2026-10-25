export type ChannelPublishRecord = {
  success: boolean;
  externalId?: string;
  error?: string;
  status?: "published" | "failed" | "not_configured" | "unknown";
};

export type ChannelPublishRecords = Record<string, ChannelPublishRecord>;

export function getChannelsToPublish<TChannel extends string>(
  enabledChannels: TChannel[],
  priorResults: ChannelPublishRecords,
): TChannel[] {
  return enabledChannels.filter((channel) => !priorResults[channel]?.success);
}

export function getCampaignStatus(
  enabledChannels: string[],
  results: ChannelPublishRecords,
): "ready" | "active" | "completed" {
  if (enabledChannels.length > 0 && enabledChannels.every((channel) => results[channel]?.success === true)) {
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
  const results: ChannelPublishRecords = {};
  if (rawResults && typeof rawResults === "object" && !Array.isArray(rawResults)) {
    for (const [channel, value] of Object.entries(rawResults)) {
      if (typeof value === "object" && value !== null && "success" in value && typeof value.success === "boolean") {
        results[channel] = value as ChannelPublishRecord;
      }
    }
  }
  return { attempts, results };
}

export function getRequiredCampaignChannels(
  metadata: Record<string, unknown> | null | undefined,
  enabledChannels: string[],
): string[] {
  const stored = metadata?.required_channels;
  return Array.isArray(stored)
    ? [...new Set(stored.filter((channel): channel is string => typeof channel === "string"))]
    : enabledChannels;
}

export function canRetryCampaign(
  metadata: Record<string, unknown> | null | undefined,
  maxAttempts: number,
  requiredChannels?: string[],
): boolean {
  const current = metadata || {};
  const { attempts, results } = getRetryMetadata(current);
  if (current.retry_exhausted === true || current.attempt_in_progress === true || attempts >= maxAttempts) return false;
  const required = getRequiredCampaignChannels(current, requiredChannels || []);
  if (required.length) return required.some((channel) => results[channel]?.success !== true);
  return Object.values(results).some((result) => result.success !== true) || Object.keys(results).length === 0;
}

export async function claimDailyProductPublishRun(
  store: {
    rpc: (name: string, args: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }>;
  },
  now = new Date(),
): Promise<{ claimed: boolean; runDate: string; idempotencyKey: string }> {
  const runDate = now.toISOString().slice(0, 10);
  const idempotencyKey = `product-publish:${runDate}`;
  const { data, error } = await store.rpc("claim_product_publish_daily_run", {
    p_run_date: runDate,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error("Could not acquire the daily product publishing lock.");
  return { claimed: data === true, runDate, idempotencyKey };
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
