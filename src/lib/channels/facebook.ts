import { getFacebookCredentialError } from '../facebook-credentials.ts';

interface FacebookPostData {
  message: string;
  link?: string;
  image_url?: string;
}

interface FacebookPublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export async function publishToFacebook(
  pageId: string,
  accessToken: string,
  data: FacebookPostData
): Promise<FacebookPublishResult> {
  try {
    const credentialError = getFacebookCredentialError(pageId, accessToken);
    if (credentialError) return { success: false, error: credentialError };

    const withPageToken = (fields: Record<string, string>) => ({ ...fields, access_token: accessToken });
    const url = data.image_url
      ? `https://graph.facebook.com/v23.0/${encodeURIComponent(pageId)}/photos`
      : `https://graph.facebook.com/v23.0/${encodeURIComponent(pageId)}/feed`;
    const body = data.image_url
      ? withPageToken({ url: data.image_url, caption: data.message })
      : withPageToken({ message: data.message, ...(data.link ? { link: data.link } : {}) });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.error || typeof result.id !== 'string' || !result.id) {
      const message = typeof result?.error?.message === 'string' ? result.error.message : 'Facebook API rejected the post.';
      return { success: false, error: message.split(accessToken).join('[REDACTED]').slice(0, 300) };
    }

    return {
      success: true,
      postId: String(result.id),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message.split(accessToken).join('[REDACTED]').slice(0, 300) : 'Unknown error',
    };
  }
}

