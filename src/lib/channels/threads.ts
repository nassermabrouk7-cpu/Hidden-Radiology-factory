interface ThreadsPostData {
  text: string;
  mediaUrl?: string;
}

interface ThreadsPublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export async function publishToThreads(
  userId: string,
  accessToken: string,
  data: ThreadsPostData
): Promise<ThreadsPublishResult> {
  try {
    const url = `https://graph.threads.net/v1.0/${userId}/threads`;

    const body: any = {
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

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Threads API error',
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
