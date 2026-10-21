import { getFacebookCredentialError } from '@/lib/facebook-credentials';

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

    const url = `https://graph.facebook.com/${pageId}/feed`;

    const body: any = {
      message: data.message,
      access_token: accessToken,
    };

    if (data.link) {
      body.link = data.link;
    }

    if (data.image_url) {
      // For images, we need to upload first, then use the photo ID
      // This is a simplified version - in production you'd upload the photo first
      body.url = data.image_url;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Facebook API error',
      };
    }

    return {
      success: true,
      postId: result.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

