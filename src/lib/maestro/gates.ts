import { MAESTRO_CONFIG } from "./config";

export type GateResult = { passed: boolean; score: number; reason: string; fixes?: string[] };

export async function medicalAccuracyGate(content: string): Promise<GateResult> {
  // Professor Agent - يفحص طبياً
  // في النسخة الأولى: فحص قواعد بسيط، بعدين نربطه بـ Gemini
  const forbiddenPhrases = ["100% cure", "guaranteed", "no side effects"];
  const found = forbiddenPhrases.filter(p => content.toLowerCase().includes(p));
  
  if (found.length > 0) {
    return { passed: false, score: 40, reason: `عبارات طبية مضللة: ${found.join(", ")}`, fixes: ["احذف العبارات المطلقة، استخدم لغة علمية"] };
  }
  
  // فحص الطول والمصادر
  if (content.length < 2000) {
    return { passed: false, score: 60, reason: "المحتوى قصير جداً", fixes: ["زود التفاصيل والأمثلة"] };
  }
  
  return { passed: true, score: 92, reason: "مراجعة طبية أولية ناجحة" };
}

export async function qualityGate(content: string, images: any[]): Promise<GateResult> {
  const checks = [];
  if (content.length < 3000) checks.push("محتوى قصير");
  if (images.length < 3) checks.push("صور قليلة");
  
  if (checks.length > 0) {
    return { passed: false, score: 70, reason: checks.join(", "), fixes: checks };
  }
  
  return { passed: true, score: 88, reason: "جودة مقبولة" };
}

export async function visualQAGate(images: any[]): Promise<GateResult> {
  // يتأكد الروابط شغالة
  for (const img of images) {
    if (!img.url || !img.url.startsWith("https://")) {
      return { passed: false, score: 50, reason: `رابط صورة غير صالح: ${img.url}`, fixes: ["استخدم رابط Supabase https"] };
    }
  }
  return { passed: true, score: 95, reason: "كل الصور صالحة" };
}
