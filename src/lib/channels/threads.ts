interface ThreadsPostData {
  text: string;
  mediaUrl?: string;
}

interface ThreadsPublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

interface ThreadsCreateBody {
  media_type: 'TEXT' | 'IMAGE';
  text: string;
  access_token: string;
  image_url?: string;
}

export async function publishToThreads(
  userId: string,
  accessToken: string,
  data: ThreadsPostData
): Promise<ThreadsPublishResult> {
  try {
    const url = `https://graph.threads.net/v1.0/${userId}/threads`;

    const body: ThreadsCreateBody = {
      media_type: 'TEXT',
      text: data.text,
      access_token: accessToken,
    };

    if (data.mediaUrl) {
      body.media_type = 'IMAGE';
      body.image_url = data.mediaUrl;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.error || typeof result.id !== 'string' || !result.id) {
      return {
        success: false,
        error: String(result.error?.message || `Threads API returned HTTP ${response.status}.`).split(accessToken).join('[REDACTED]').slice(0, 300),
      };
    }

    // Step 2: Publish the thread (Threads requires a 2-step process)
    const creationId = result.id;
    const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`;

    const publishBody = {
      creation_id: creationId,
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
        error: String(publishResult.error?.message || `Threads publish returned HTTP ${publishResponse.status}.`).split(accessToken).join('[REDACTED]').slice(0, 300),
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
