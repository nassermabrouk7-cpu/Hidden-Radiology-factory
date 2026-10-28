const DAILY_PUBLISH_HOUR_UTC = 6;

export function selectNextMarketingProduct<T extends { id: string }>(
  products: T[],
  campaigns: Array<{ product_id: string; created_at: string }>,
): T | undefined {
  const latestCampaignByProduct = new Map<string, string>();
  for (const campaign of campaigns) {
    const productId = String(campaign.product_id);
    const createdAt = campaign.created_at || "";
    const latest = latestCampaignByProduct.get(productId);
    if (!latest || createdAt > latest) latestCampaignByProduct.set(productId, createdAt);
  }

  return products.reduce<T | undefined>((selected, product) => {
    if (!selected) return product;
    const productLastCampaign = latestCampaignByProduct.get(String(product.id)) || "";
    const selectedLastCampaign = latestCampaignByProduct.get(String(selected.id)) || "";
    return productLastCampaign < selectedLastCampaign ? product : selected;
  }, undefined);
}

export async function claimDailyMarketingGenerationRun(
  store: {
    rpc: (
      name: "claim_marketing_generation_daily_run",
      args: { p_run_date: string },
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  },
  now = new Date(),
): Promise<{ claimed: boolean; runDate: string }> {
  const runDate = now.toISOString().slice(0, 10);
  const { data, error } = await store.rpc("claim_marketing_generation_daily_run", {
    p_run_date: runDate,
  });
  if (error) throw new Error("Could not acquire the daily marketing generation lock.");
  return { claimed: data === true, runDate };
}

/** Return a future 06:00 UTC slot; each index moves forward by one day. */
export function getDailyMarketingSchedule(index: number, now = new Date()): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Marketing schedule index must be a non-negative integer");
  }

  const firstSlot = new Date(now);
  firstSlot.setUTCHours(DAILY_PUBLISH_HOUR_UTC, 0, 0, 0);
  if (firstSlot.getTime() <= now.getTime()) {
    firstSlot.setUTCDate(firstSlot.getUTCDate() + 1);
  }
  firstSlot.setUTCDate(firstSlot.getUTCDate() + index);
  return firstSlot.toISOString();
}
