type BookDraftRequest = {
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  category: string;
  language: "ar" | "en";
  brief: string;
};

export async function generateBookDraft(input: BookDraftRequest): Promise<string> {
  if (process.env.GEMINI_FREE_TIER_ONLY !== "true") {
    throw new Error("توليد الذكاء الاصطناعي متوقف حتى تأكيد أن مشروع Gemini على الخطة المجانية");
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("مفتاح Gemini غير مهيأ على الخادم");

  const languageName = input.language === "ar" ? "Arabic" : "English";
  const prompt = `Write a complete first-draft educational study guide for radiology learners.
Write only in ${languageName}. Do not mix languages.
Title: ${input.language === "ar" ? input.titleAr : input.titleEn}
Subtitle: ${input.language === "ar" ? input.subtitleAr : input.subtitleEn}
Category: ${input.category}
Author brief: ${input.brief}

Requirements:
- Create a useful, coherent guide with a short introduction, 8 clearly titled sections, practical checklists where appropriate, and a concise conclusion.
- Keep all material educational and general. Never give patient-specific advice.
- Do not invent citations, research papers, statistics, guidelines, patient cases, or guaranteed outcomes. If a claim needs verification, mark it [VERIFY] instead of guessing.
- Use clear paragraphs and separate sections with blank lines. Avoid tables and markdown code blocks.
- Return only the manuscript text, with no preamble about being an AI.`;

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 6000 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(50_000),
    },
  );

  if (!response.ok) {
    // Provider bodies may echo input or account details; never return them to the browser.
    throw new Error(`تعذر توليد مسودة الكتاب (رمز الخدمة ${response.status})`);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || !("candidates" in payload)) {
    throw new Error("أعاد Gemini استجابة غير صالحة");
  }
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  const manuscript = candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
  if (!manuscript || manuscript.length < 500 || manuscript.length > 100_000) {
    throw new Error("المسودة الناتجة قصيرة جداً أو تجاوزت الحد المسموح");
  }
  return manuscript;
}
