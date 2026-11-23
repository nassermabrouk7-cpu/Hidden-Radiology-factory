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
    if (!/^\d{10,20}$/.test(instagramBusinessAccountId) || !accessToken || accessToken.includes('|') || /SENSITIVE|REDACTED|^\[.*\]$/i.test(accessToken)) {
      return { success: false, error: 'Instagram account ID or access token is malformed.' };
    }
    // Step 1: Create media container
    const containerUrl = `https://graph.facebook.com/${encodeURIComponent(instagramBusinessAccountId)}/media`;

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

    const containerResult = await containerResponse.json().catch(() => ({}));

    if (!containerResponse.ok || containerResult.error || typeof containerResult.id !== 'string' || !containerResult.id) {
      return {
        success: false,
        error: `Container creation failed: ${containerResult.error?.message || `HTTP ${containerResponse.status}`}`.split(accessToken).join('[REDACTED]').slice(0, 300),
      };
    }

    const containerId = containerResult.id;

    // Wait for container to be ready
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(`https://graph.facebook.com/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`);
      const statusJson = await statusRes.json().catch(() => ({}));
      if (statusJson.status_code === "FINISHED") break;
      if (statusJson.status_code === "ERROR") {
        return { success: false, error: `Container failed: ${statusJson.error?.message || "Image processing failed"}`.slice(0, 300) };
      }
      if (attempt === 9) {
        return { success: false, error: "Container timed out - image not ready after 30s" };
      }
    }

    // Step 2: Publish the container
    const publishUrl = `https://graph.facebook.com/${encodeURIComponent(instagramBusinessAccountId)}/media_publish`;

    const publishBody = {
      creation_id: containerId,
      access_token: accessToken,
    };

    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publishBody),
    });

    const publishResult = await publishResponse.json().catch(() => ({}));

    if (!publishResponse.ok || publishResult.error || typeof publishResult.id !== 'string' || !publishResult.id) {
      return {
        success: false,
        error: `Publish failed: ${publishResult.error?.message || `HTTP ${publishResponse.status}`}`.split(accessToken).join('[REDACTED]').slice(0, 300),
      };
    }

    return {
      success: true,
      postId: publishResult.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message.split(accessToken).join('[REDACTED]').slice(0, 300) : 'Unknown error',
    };
  }
}