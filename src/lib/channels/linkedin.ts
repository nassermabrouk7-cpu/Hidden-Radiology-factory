interface LinkedInPostData {
  text: string;
  link?: string;
}

interface LinkedInPublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

interface LinkedInMedia {
  status: 'READY';
  description: { text: string };
  originalUrl: string;
}

interface LinkedInShareContent {
  shareCommentary: { text: string };
  shareMediaCategory: 'NONE' | 'ARTICLE';
  media?: LinkedInMedia[];
}

interface LinkedInPostPayload {
  author: string;
  lifecycleState: 'PUBLISHED';
  specificContent: {
    'com.linkedin.ugc.ShareContent': LinkedInShareContent;
  };
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC';
  };
}

export async function publishToLinkedIn(
  organizationId: string,
  accessToken: string,
  data: LinkedInPostData
): Promise<LinkedInPublishResult> {
  try {
    const url = 'https://api.linkedin.com/v2/ugcPosts';

    // Build the post content
    const content: LinkedInPostPayload = {
      author: `urn:li:organization:${organizationId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: data.text,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    // Add link if provided
    if (data.link) {
      const shareContent = content.specificContent['com.linkedin.ugc.ShareContent'];
      shareContent.shareMediaCategory = 'ARTICLE';
      shareContent.media = [
        {
          status: 'READY',
          description: {
            text: data.text.substring(0, 200),
          },
          originalUrl: data.link,
        },
      ];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(content),
    });

    const result = await response.json().catch(() => ({}));

    const postId = response.headers.get('x-restli-id') || result.id;
    if (!response.ok || result.error || typeof postId !== 'string' || !postId) {
      return {
        success: false,
        error: String(result.error?.message || `LinkedIn API returned HTTP ${response.status}.`).split(accessToken).join('[REDACTED]').slice(0, 300),
      };
    }

    return {
      success: true,
      postId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message.split(accessToken).join('[REDACTED]').slice(0, 300) : 'Unknown error',
    };
  }
}
