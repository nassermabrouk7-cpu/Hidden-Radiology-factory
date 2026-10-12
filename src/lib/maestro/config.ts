export const MAESTRO_CONFIG = {
  maxRetries: 3,
  qualityThreshold: 85,
  medicalThreshold: 90,
  dailyLimit: 1,
  requireHumanApproval: true, // true = انت تراجع قبل النشر، false = تلقائي 100%
  cronSchedule: "0 5 * * *", // 5 الصبح بتوقيت UTC = 7 الصبح مصر
}

export type MaestroStage = 
  | "idea" 
  | "outline" 
  | "writing" 
  | "artwork" 
  | "medical_review" 
  | "quality_gate" 
  | "human_approval" 
  | "publishing" 
  | "done" 
  | "failed";

export const STAGE_LABELS: Record<MaestroStage, string> = {
  idea: "💡 توليد الفكرة",
  outline: "📋 بناء الخطة",
  writing: "✍️ كتابة المحتوى",
  artwork: "🎨 توليد الصور",
  medical_review: "🩺 المراجعة الطبية",
  quality_gate: "✅ بوابة الجودة",
  human_approval: "👨‍⚕️ موافقة بشرية",
  publishing: "📦 النشر والتسليم",
  done: "🎉 مكتمل",
  failed: "❌ فشل"
}
