// قائمة 36 كتاب موجود - المصنع لا يكررها
export const EXISTING_36_TITLES = [
  "أساسيات الأشعة السينية للصدر",
  "الأشعة المقطعية للبطن",
  "رنين المخ",
  "أشعة العظام والمفاصل",
  "أشعة الأطفال",
  "أشعة الطوارئ",
  "أشعة الصدر المقطعية",
  "تشريح الأشعة",
  "أشعة الحوض",
  "أورام الرئة",
  // سيتم ملؤها تلقائيا - ضع عناوين كتبك الحقيقية هنا
];

interface BookIdea {
  titleAr: string;
  titleEn?: string;
  category?: string;
  brief?: string;
}

export function isDuplicate(newTitle: string, existingTitles: string[]): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').trim();
  const newNorm = normalize(newTitle);
  return existingTitles.some(t => {
    const existNorm = normalize(t);
    return newNorm.includes(existNorm.substring(0, 10)) || existNorm.includes(newNorm.substring(0, 10));
  });
}

export function getNonDuplicateIdea(ideas: BookIdea[], existingTitles: string[]): BookIdea {
  for (const idea of ideas) {
    if (!isDuplicate(idea.titleAr, existingTitles)) return idea;
  }
  // لو كل الأفكار مكررة، ولد عنوان جديد
  return {
    titleAr: `دليل متقدم في الأشعة - ${Date.now().toString().slice(-4)}`,
    titleEn: `Advanced Radiology Guide - ${Date.now().toString().slice(-4)}`,
    category: 'Advanced',
    brief: 'موضوع متقدم جديد غير موجود في المكتبة'
  };
}
