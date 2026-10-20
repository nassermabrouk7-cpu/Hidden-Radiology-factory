interface LinkedInPostData {
  text: string;
  link?: string;
}

interface LinkedInPublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export async function publishToLinkedIn(
  organizationId: string,
  accessToken: string,
  data: LinkedInPostData
): Promise<LinkedInPublishResult> {
  try {
    const url = 'https://api.linkedin.com/v2/ugcPosts';

    // Build the post content
    const content: any = {
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
      content.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
      content.specificContent['com.linkedin.ugc.ShareContent'].media = [
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

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'LinkedIn API error',
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
