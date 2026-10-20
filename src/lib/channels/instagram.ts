interface InstagramPostData {
  imageUrl: string;
  caption: string;
}

interface InstagramPublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export async function publishToInstagram(
  instagramBusinessAccountId: string,
  accessToken: string,
  data: InstagramPostData
): Promise<InstagramPublishResult> {
  try {
    // Step 1: Create media container
    const containerUrl = `https://graph.facebook.com/${instagramBusinessAccountId}/media`;

    const containerBody = {
      image_url: data.imageUrl,
      caption: data.caption,
      access_token: accessToken,
    };

    const containerResponse = await fetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody),
    });

    const containerResult = await containerResponse.json();

    if (containerResult.error) {
      return {
        success: false,
        error: `Container creation failed: ${containerResult.error.message}`,
      };
    }

    const containerId = containerResult.id;

    // Step 2: Publish the container
    const publishUrl = `https://graph.facebook.com/${instagramBusinessAccountId}/media_publish`;

    const publishBody = {
      creation_id: containerId,
      access_token: accessToken,
    };

    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publishBody),
    });

    const publishResult = await publishResponse.json();

    if (publishResult.error) {
      return {
        success: false,
        error: `Publish failed: ${publishResult.error.message}`,
      };
    }

    return {
      success: true,
      postId: publishResult.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
