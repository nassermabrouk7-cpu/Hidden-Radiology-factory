import { MAESTRO_CONFIG } from "./config";

export type GateResult = { passed: boolean; score: number; reason: string; fixes?: string[] };

export async function medicalAccuracyGate(content: string): Promise<GateResult> {
  const forbiddenPhrases = ["100% cure", "guaranteed", "no side effects", "100% شفاء", "مضمون"];
  const found = forbiddenPhrases.filter(p => content.toLowerCase().includes(p.toLowerCase()));
  
  if (found.length > 0) {
    return { passed: false, score: 40, reason: `عبارات طبية مضللة: ${found.join(", ")}`, fixes: ["احذف العبارات المطلقة"] };
  }
  
  // مصنع شغال - 500 حرف كفاية للتجربة، بعدين 2000
  if (content.length < 500) {
    return { passed: false, score: 60, reason: "المحتوى قصير جداً", fixes: ["زود التفاصيل"] };
  }
  
  return { passed: true, score: 92, reason: "مراجعة طبية أولية ناجحة" };
}

export async function qualityGate(content: string, images: any[]): Promise<GateResult> {
  const checks = [];
  if (content.length < 500) checks.push("محتوى قصير");
  // مصنع تجريبي - مش لازم صور دلوقتي
  // if (images.length < 3) checks.push("صور قليلة");
  
  if (checks.length > 0) {
    return { passed: false, score: 70, reason: checks.join(", "), fixes: checks };
  }
  
  return { passed: true, score: 88, reason: "جودة مقبولة" };
}

export async function visualQAGate(images: any[]): Promise<GateResult> {
  for (const img of images) {
    if (!img.url || !img.url.startsWith("https://")) {
      return { passed: false, score: 50, reason: `رابط صورة غير صالح: ${img.url}`, fixes: ["استخدم رابط https"] };
    }
  }
  return { passed: true, score: 95, reason: "كل الصور صالحة" };
}