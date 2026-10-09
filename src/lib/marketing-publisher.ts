import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isMarketingItemPublishAuthorized } from "@/lib/marketing-auth";

type Platform = "instagram" | "facebook" | "linkedin";

type MarketingContent = {
  id: string;
  campaign_id: string;
  product_id: string;
  platform: Platform;
  language: "ar" | "en";
  content_type: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  destination_url: string | null;
  scheduled_at: string | null;
  status: "queued" | "approved" | "scheduled" | "published" | "failed";
  metadata: Record<string, unknown>;
  publish_attempts: number;
  published_at: string | null;
  external_post_id: string | null;
  error_message: string | null;
};

type PublishResult = {
  success: boolean;
  externalPostId?: string;
  response?: Record<string, unknown>;
  error?: string;
};

function isMetricoolEnabled(): boolean {
  return process.env.MARKETING_ALLOW_PAID_METRICOOL_API === "true" && Boolean(process.env.METRICOOL_API_TOKEN);
}

function sanitizeError(value: unknown): string {
  let message = typeof value === "string" ? value : "Unknown publishing error";
  for (const secret of [process.env.METRICOOL_API_TOKEN, process.env.FACEBOOK_PAGE_ACCESS_TOKEN, process.env.INSTAGRAM_ACCESS_TOKEN, process.env.LINKEDIN_ACCESS_TOKEN, process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]) {
    if (secret) message = message.split(secret).join("[REDACTED]");
  }
  return message.slice(0, 500);
}

function isTrustedMediaUrl(value: string): boolean {
  try {
    const media = new URL(value);
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (media.protocol !== "https:" || !supabase) return false;
    return media.hostname === new URL(supabase).hostname && media.pathname.includes("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

function sanitizeText(value: string): string {
  let result = value;
  for (const secret of [process.env.METRICOOL_API_TOKEN, process.env.FACEBOOK_PAGE_ACCESS_TOKEN, process.env.INSTAGRAM_ACCESS_TOKEN, process.env.LINKEDIN_ACCESS_TOKEN, process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]) {
    if (secret) result = result.split(secret).join("[REDACTED]");
  }
  return result;
}

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function buildPostText(content: MarketingContent): string {
  const parts = [
    content.title,
    content.hook,
    content.body,
    content.cta,
  ].filter(Boolean);

  if (content.destination_url) {
    parts.push(content.destination_url);
  }

  if (content.hashtags?.length) {
    parts.push(
      content.hashtags
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
        .join(" ")
    );
  }

  return parts.join("\n\n").trim();
}

/**
 * Facebook publishing adapter.
 *
 * This intentionally fails until the required Meta credentials
 * are configured. No credentials are hard-coded.
 */
async function publishToFacebook(
  content: MarketingContent
): Promise<PublishResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    return {
      success: false,
      error:
        "Facebook publisher is not configured. Missing FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN.",
    };
  }

  const message = buildPostText(content);

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${encodeURIComponent(pageId)}/feed`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        access_token: accessToken,
      }),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.id) {
    return {
      success: false,
      response: sanitizeResponse(data),
      error:
        sanitizeError(data?.error?.message) ||
        `Facebook API returned HTTP ${response.status}.`,
    };
  }

  return {
    success: true,
    externalPostId: String(data.id),
    response: sanitizeResponse(data),
  };
}

/**
 * Instagram publishing adapter.
 *
 * Instagram publishing requires an Instagram professional account
 * connected to a Facebook Page and uses a media-container flow.
 *
 * We do not pretend that a simple text-only post can be published.
 * Until a valid public image/video URL is supplied, this adapter
 * deliberately reports configuration/incompatibility.
 */
async function publishToInstagram(
  content: MarketingContent
): Promise<PublishResult> {
  const instagramUserId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!instagramUserId || !accessToken) {
    return {
      success: false,
      error:
        "Instagram publisher is not configured. Missing INSTAGRAM_USER_ID or INSTAGRAM_ACCESS_TOKEN.",
    };
  }

  const mediaUrl =
    typeof content.metadata?.media_url === "string"
      ? content.metadata.media_url
      : null;

  if (mediaUrl && !isTrustedMediaUrl(mediaUrl)) {
    return { success: false, error: "The media URL is not from the trusted public Supabase storage host." };
  }

  if (!mediaUrl) {
    return {
      success: false,
      error:
        "Instagram requires a public media URL. No metadata.media_url is available for this content item.",
    };
  }

  const caption = buildPostText(content);

  const containerResponse = await fetch(
    `https://graph.facebook.com/v23.0/${encodeURIComponent(
      instagramUserId
    )}/media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: mediaUrl,
        caption,
        access_token: accessToken,
      }),
      cache: "no-store",
    }
  );

  const containerData = await containerResponse.json().catch(() => ({}));

  if (!containerResponse.ok || !containerData?.id) {
    return {
      success: false,
      response: sanitizeResponse(containerData),
      error:
        sanitizeError(containerData?.error?.message) ||
        `Instagram container API returned HTTP ${containerResponse.status}.`,
    };
  }

  const containerId = String(containerData.id);

  const publishResponse = await fetch(
    `https://graph.facebook.com/v23.0/${encodeURIComponent(
      instagramUserId
    )}/media_publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
      cache: "no-store",
    }
  );

  const publishData = await publishResponse.json().catch(() => ({}));

  if (!publishResponse.ok || !publishData?.id) {
    return {
      success: false,
      response: sanitizeResponse(publishData),
      error:
        sanitizeError(publishData?.error?.message) ||
        `Instagram publish API returned HTTP ${publishResponse.status}.`,
    };
  }

  return {
    success: true,
    externalPostId: String(publishData.id),
    response: sanitizeResponse(publishData),
  };
}

/**
 * LinkedIn adapter.
 *
 * The current implementation intentionally requires the
 * LinkedIn credentials and organization/person URN before publishing.
 */
async function publishToLinkedIn(
  content: MarketingContent
): Promise<PublishResult> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const authorUrn = process.env.LINKEDIN_AUTHOR_URN;

  if (!accessToken || !authorUrn) {
    return {
      success: false,
      error:
        "LinkedIn publisher is not configured. Missing LINKEDIN_ACCESS_TOKEN or LINKEDIN_AUTHOR_URN.",
    };
  }

  const text = buildPostText(content);

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version":
        process.env.LINKEDIN_VERSION || "202601",
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      success: false,
      response: sanitizeResponse(data),
      error:
        sanitizeError(data?.message) ||
        data?.serviceErrorCode ||
        `LinkedIn API returned HTTP ${response.status}.`,
    };
  }

  const postId =
    response.headers.get("x-restli-id") ||
    data?.id ||
    data?.post;

  if (!postId) {
    return {
      success: false,
      response: sanitizeResponse(data),
      error: "LinkedIn API returned success but no post ID was found.",
    };
  }

  return {
    success: true,
    externalPostId: String(postId),
    response: sanitizeResponse(data),
  };
}

/**
 * Remove anything that could accidentally expose credentials
 * before storing API responses in the database.
 */
function sanitizeResponse(
  value: unknown
): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const clone = JSON.parse(JSON.stringify(value));

  const sensitiveKeys = [
    "access_token",
    "accessToken",
    "authorization",
    "Authorization",
    "token",
    "client_secret",
    "clientSecret",
  ];

  function redact(object: Record<string, unknown>) {
    for (const key of Object.keys(object)) {
      if (sensitiveKeys.includes(key)) {
        object[key] = "[REDACTED]";
        continue;
      }

      const current = object[key];

      if (typeof current === "string") {
        object[key] = sanitizeText(current);
        continue;
      }

      if (current && typeof current === "object") {
        if (Array.isArray(current)) {
          for (const item of current) {
            if (item && typeof item === "object") {
              redact(item as Record<string, unknown>);
            }
          }
        } else {
          redact(current as Record<string, unknown>);
        }
      }
    }
  }

  redact(clone);

  return clone;
}

async function publishToMetricool(content: MarketingContent): Promise<PublishResult> {
  const token = process.env.METRICOOL_API_TOKEN;
  const userId = process.env.METRICOOL_USER_ID;
  const blogId = process.env.METRICOOL_BLOG_ID;
  const timezone = process.env.METRICOOL_TIMEZONE || "Africa/Cairo";

  if (!isMetricoolEnabled() || !token || !userId || !blogId) {
    return { success: false, error: "Metricool publisher is not configured." };
  }

  const mediaUrl =
    typeof content.metadata?.media_url === "string"
      ? content.metadata.media_url
      : null;

  if (mediaUrl && !isTrustedMediaUrl(mediaUrl)) {
    return { success: false, error: "The media URL is not from the trusted public Supabase storage host." };
  }

  if (content.platform === "instagram" && !mediaUrl) {
    return {
      success: false,
      error: "Instagram publishing requires a public media_url.",
    };
  }

  let normalizedMediaUrl: string | null = null;
  if (mediaUrl) {
    const normalizeParams = new URLSearchParams({ url: mediaUrl, userId, blogId });
    const normalizeResponse = await fetch(
      `https://app.metricool.com/api/actions/normalize/image/url?${normalizeParams}`,
      { headers: { "X-Mc-Auth": token }, cache: "no-store" },
    );
    const normalizeText = await normalizeResponse.text();
    let normalized: unknown;
    try {
      normalized = normalizeText ? JSON.parse(normalizeText) : null;
    } catch {
      normalized = normalizeText;
    }
    if (!normalizeResponse.ok) {
      return { success: false, response: sanitizeResponse(normalized), error: `Metricool could not prepare the image (HTTP ${normalizeResponse.status}).` };
    }
    const normalizedRecord = normalized && typeof normalized === "object" ? normalized as Record<string, unknown> : {};
    const normalizedValue = typeof normalized === "string"
      ? normalized
      : normalizedRecord.url ?? normalizedRecord.mediaUrl ?? normalizedRecord.imageUrl ?? normalizedRecord.data;
    if (typeof normalizedValue !== "string" || !/^https:\/\//i.test(normalizedValue)) {
      return { success: false, response: sanitizeResponse(normalized), error: "Metricool did not return a usable public image URL." };
    }
    normalizedMediaUrl = normalizedValue;
  }

  const requestedMs = content.scheduled_at
    ? new Date(content.scheduled_at).getTime()
    : 0;
  const publishMs = Math.max(Date.now() + 120000, requestedMs);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(publishMs));

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  const dateTime = `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;

  const body = {
    publicationDate: { dateTime, timezone },
    text: buildPostText(content),
    providers: [{ network: content.platform }],
    autoPublish: true,
    draft: false,
    shortener: false,
    saveExternalMediaFiles: Boolean(normalizedMediaUrl),
    media: normalizedMediaUrl ? [normalizedMediaUrl] : [],
    ...(content.platform === "facebook"
      ? { facebookData: { type: "POST" } }
      : {}),
    ...(content.platform === "instagram"
      ? {
          instagramData: {
            type: "POST",
            isAiGenerated: true,
          },
        }
      : {}),
    ...(content.platform === "linkedin"
      ? { linkedinData: { type: "post" } }
      : {}),
  };

  const response = await fetch(
    `https://app.metricool.com/api/v2/scheduler/posts?blogId=${encodeURIComponent(
      blogId
    )}&userId=${encodeURIComponent(userId)}`,
    {
      method: "POST",
      headers: {
        "X-Mc-Auth": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const raw = await response.text();
  let data: unknown = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
        ? String((data as { message: string }).message)
        : raw.slice(0, 300);

    return {
      success: false,
      response: sanitizeResponse(data),
      error: `Metricool API returned HTTP ${response.status}: ${message}`,
    };
  }

  const record =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : {};

  const postId =
    record.id ??
    record.uuid ??
    (record.data &&
    typeof record.data === "object"
      ? (record.data as Record<string, unknown>).id
      : null);

  return {
    success: true,
    externalPostId: postId ? String(postId) : undefined,
    response: sanitizeResponse(data),
  };
}

async function publishContent(
  content: MarketingContent
): Promise<PublishResult> {
  if (isMetricoolEnabled()) {
    return publishToMetricool(content);
  }

  switch (content.platform) {
    case "facebook":
      return publishToFacebook(content);
    case "instagram":
      return publishToInstagram(content);
    case "linkedin":
      return publishToLinkedIn(content);
    default:
      return {
        success: false,
        error: `Unsupported marketing platform: ${content.platform}`,
      };
  }
}

/**
 * Publishes one eligible item from the marketing queue.
 */
export async function publishNextMarketingItem(): Promise<{
  processed: boolean;
  contentId?: string;
  platform?: Platform;
  success?: boolean;
  error?: string;
}> {
  if (!isMarketingItemPublishAuthorized("approved")) {
    return { processed: false, error: "Automatic social publishing is disabled." };
  }
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const staleLockBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { error: staleLockError } = await supabase
    .from("marketing_content")
    .update({ status: "queued", updated_at: now })
    .eq("status", "scheduled")
    .is("platform_response", null)
    .is("external_post_id", null)
    .lt("last_attempt_at", staleLockBefore);
  if (staleLockError) throw new Error(`Failed to recover stale publishing item: ${staleLockError.message}`);

  const configuredPlatforms: Platform[] = isMetricoolEnabled()
    ? (process.env.METRICOOL_PLATFORMS || "facebook,instagram,linkedin").split(",").map((value) => value.trim()).filter((value): value is Platform => ["facebook", "instagram", "linkedin"].includes(value as Platform))
    : (["instagram", "facebook", "linkedin"] as Platform[]).filter((platform) => {
        if (platform === "facebook") return Boolean(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
        if (platform === "instagram") return Boolean(process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN);
        return Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN);
      });

  // Generated queue items require an explicit admin approval before any provider call.
  const eligibleStatuses = ["approved"];

  let query = supabase
    .from("marketing_content")
    .select("*")
    .in("status", eligibleStatuses)
    .in("platform", configuredPlatforms)
    .not("scheduled_at", "is", null)
    .is("published_at", null)
    .order("scheduled_at", { ascending: true });

  if (!isMetricoolEnabled()) {
    query = query.lte("scheduled_at", now);
  }

  const { data: content, error: selectError } = await query
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new Error(
      `Failed to read marketing queue: ${selectError.message}`
    );
  }

  if (!content) {
    return {
      processed: false,
    };
  }

  const typedContent = content as MarketingContent;
  if (!isMarketingItemPublishAuthorized(typedContent.status)) {
    return { processed: false, error: "Marketing content has not been explicitly approved." };
  }

  const attemptNumber = (typedContent.publish_attempts || 0) + 1;

  const { data: claimedItem, error: attemptError } = await supabase
    .from("marketing_content")
    .update({
      // `scheduled` is already a valid database status and works as an atomic claim.
      status: "scheduled",
      publish_attempts: attemptNumber,
      last_attempt_at: now,
      error_message: null,
      updated_at: now,
    })
    .eq("id", typedContent.id)
    .eq("status", typedContent.status)
    .is("published_at", null)
    .select("id")
    .maybeSingle();

  if (attemptError) {
    throw new Error(
      `Failed to lock publishing item: ${attemptError.message}`
    );
  }
  if (!claimedItem) return { processed: false };

  const result = await publishContent(typedContent);

  if (result.success) {
    const { error: successError } = await supabase
      .from("marketing_content")
      .update({
        status: isMetricoolEnabled() ? "scheduled" : "published",
        published_at: isMetricoolEnabled() ? null : new Date().toISOString(),
        external_post_id: result.externalPostId || null,
        error_message: null,
        platform_response: result.response || {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", typedContent.id)
      .is("published_at", null);

    if (successError) {
      throw new Error(
        `Content was published but database update failed: ${successError.message}`
      );
    }

    return {
      processed: true,
      contentId: typedContent.id,
      platform: typedContent.platform,
      success: true,
    };
  }

  const { error: failureError } = await supabase
    .from("marketing_content")
    .update({
      status: "failed",
      error_message: sanitizeError(result.error) || "Unknown publishing error",
      platform_response: result.response || {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", typedContent.id)
    .is("published_at", null);

  if (failureError) {
    throw new Error(
      `Failed to record publishing failure: ${failureError.message}`
    );
  }

  return {
    processed: true,
    contentId: typedContent.id,
    platform: typedContent.platform,
    success: false,
    error: sanitizeError(result.error) || "Unknown publishing error",
  };
}
