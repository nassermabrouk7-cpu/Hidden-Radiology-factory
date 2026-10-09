type Product = {
  id: string;
  title_ar: string;
  title_en: string;
  category: string;
  price: number;
  language: string;
  cover_url?: string | null;
};

export type GeneratedCampaign = {
  name: string;
  objective: string;
  audience: string;
  positioning: string;
  theme: string;
  language_strategy: string;
  content: Array<{
    platform: "instagram" | "facebook" | "linkedin";
    language: "ar" | "en";
    content_type:
      | "authority"
      | "education"
      | "product"
      | "trust"
      | "conversion";
    title: string;
    hook: string;
    body: string;
    cta: string;
    hashtags: string[];
  }>;
};

function getApiKey() {
  if (process.env.GEMINI_FREE_TIER_ONLY !== "true") {
    throw new Error("Gemini generation is disabled until the provider project is verified as free tier");
  }
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return key;
}

function getModel() {
  return process.env.GEMINI_MODEL || "gemini-3.8-flash";
}

function parseJson<T>(text: string): T {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Gemini returned invalid JSON");
    }

    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      console.error("Gemini raw output:", cleaned.slice(0, 5000));
      throw new Error("Gemini returned invalid JSON");
    }
  }
}

export async function generateCampaign(
  product: Product,
  platforms: Array<"instagram" | "facebook" | "linkedin"> = ["instagram", "facebook", "linkedin"]
): Promise<GeneratedCampaign> {
  const prompt = `
You are the marketing strategist for Hidden Radiology, a professional radiology education brand.

Product:
${JSON.stringify(product)}

Create exactly 12 social media content items.

Requirements:
- 4 authority
- 3 education
- 2 trust
- 3 product or conversion
- Create 12 items total: 6 Arabic items with language "ar" and 6 English items with language "en". Each content object MUST use exactly one language value: "ar" or "en".
- Only use these configured platforms: ${platforms.join(", ")}.
- Professional academic tone.
- Educational and trustworthy.
- Do not invent patient cases, medical statistics, guidelines, diagnoses, or guaranteed outcomes.
- Do not give patient-specific medical advice. Keep clinical topics general and link claims to the product only when supported by its title/category.
- Present the product as an educational resource.
- Keep every post self-contained and suitable for its chosen platform. Hashtags should match the post language.
- Return ONLY valid JSON.

Return exactly this structure:

{
  "name": "string",
  "objective": "string",
  "audience": "string",
  "positioning": "string",
  "theme": "string",
  "language_strategy": "ar+en",
  "content": [
    {
      "platform": "instagram",
      "language": "ar",
      "content_type": "authority",
      "title": "string",
      "hook": "string",
      "body": "string",
      "cta": "string",
      "hashtags": ["string"]
    }
  ]
}

The content array MUST contain exactly 12 objects.
`;

  const model = getModel();

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens: 8000,
    },
  };

  let response: Response | null = null;
  let raw = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": getApiKey(),
        },
        body: JSON.stringify(requestBody),
      }
    );

    raw = await response.text();

    if (response.ok) {
      break;
    }

    if (![429, 503].includes(response.status) || attempt === 3) {
      console.error(
        "Gemini marketing request failed:",
        response.status,
        raw.slice(0, 1000)
      );

      throw new Error(`Gemini request failed (${response.status})`);
    }

    console.warn(
      `Gemini temporary failure (${response.status}), retrying attempt ${attempt + 1}/3`
    );

    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }

  if (!response || !response.ok) {
    throw new Error("Gemini request failed");
  }

  let payload: {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("Gemini returned invalid response");
  }

  const outputText =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "";

  if (!outputText) {
    throw new Error("Gemini returned empty output");
  }

  return parseJson<GeneratedCampaign>(outputText);
}
