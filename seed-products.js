const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
const url = lines.find(l => l.includes('SUPABASE_URL'))?.split('=')[1]?.trim();
const key = lines.find(l => l.includes('SERVICE_ROLE'))?.split('=')[1]?.trim();

if (!url || !key) {
  console.log('❌ المفاتيح غير موجودة في .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);
const projectUrl = url.replace(/\/$/, '');

const books = [
  {
    cover_ar: "ai-in-radiology-ar.jpg",
    pdf_ar: "ai-in-radiology-ar.pdf",
    cover_en: "ai-in-radiology-en.jpg",
    pdf_en: "ai-in-radiology-en.pdf",
    title_ar: "الذكاء الاصطناعي في الأشعة",
    title_en: "AI in Radiology",
    category: "AI & Technology",
    price: 14.99
  },
  {
    cover_ar: "chest-x-ray-made-easy-ar.jpg",
    pdf_ar: "chest-xray-made-easy-ar-final.pdf",
    cover_en: "chest-x-ray-made-easy-en.jpg",
    pdf_en: "chest-xray-made-easy-en-final.pdf",
    title_ar: "أشعة الصدر بسهولة",
    title_en: "Chest X-Ray Made Easy",
    category: "Chest X-Ray",
    price: 9.99
  },
  {
    cover_ar: "ct-cover-ar.jpg",
    pdf_ar: "ct-made-easy-ar-final.pdf",
    cover_en: "ct-cover-en.jpg",
    pdf_en: "ct-made-easy-en-final.pdf",
    title_ar: "الأشعة المقطعية بسهولة",
    title_en: "CT Made Easy",
    category: "CT Scan",
    price: 12.99
  },
  {
    cover_ar: "ct-protocols-master-guide-ar.jpg",
    pdf_ar: "ct-protocols-master-guide-ar.pdf",
    cover_en: "ct-protocols-master-guide-en.jpg",
    pdf_en: "ct-protocols-master-guide-en.pdf",
    title_ar: "دليل بروتوكولات الأشعة المقطعية",
    title_en: "CT Protocols Master Guide",
    category: "Protocols",
    price: 19.99
  },
  {
    cover_ar: "cxr-cover-ar.jpg",
    pdf_ar: "ana-fahim-cxr-ar.pdf",
    cover_en: "cxr-cover-en.jpg",
    pdf_en: "ana-fahim-cxr-en.pdf",
    title_ar: "أنا أفهم أشعة الصدر",
    title_en: "I Understand Chest X-Ray",
    category: "Chest X-Ray",
    price: 9.99
  },
  {
    cover_ar: "ct-cover-ar.jpg",
    pdf_ar: "ana-fahim-ct-ar.pdf",
    cover_en: "ct-cover-en.jpg",
    pdf_en: "ana-fahim-ct-en.pdf",
    title_ar: "أنا أفهم الأشعة المقطعية",
    title_en: "I Understand CT",
    category: "CT Scan",
    price: 12.99
  },
  {
    cover_ar: "mri-ar.jpg",
    pdf_ar: "ana-fahim-mri-ar.pdf",
    cover_en: "mri-cover-en.jpg",
    pdf_en: "ana-fahim-mri-en.pdf",
    title_ar: "أنا أفهم الرنين المغناطيسي",
    title_en: "I Understand MRI",
    category: "MRI",
    price: 14.99
  },
  {
    cover_ar: "ana-fahim-quality-safety-cover-ar.jpg",
    pdf_ar: "ana-fahim-quality-safety-ar.pdf",
    cover_en: "qs-cover-en.jpg",
    pdf_en: "ana-fahim-quality-safety-en.pdf",
    title_ar: "الجودة والسلامة في الأشعة",
    title_en: "Quality & Safety in Radiology",
    category: "Quality & Safety",
    price: 14.99
  },
  {
    cover_ar: "dalil-career-fanni-ashiaa-ar.png",
    pdf_ar: "career-guide-radiology-technician-ar.pdf",
    cover_en: "career-guide-radiology-technician-en.png",
    pdf_en: "career-guide-radiology-technician-en.pdf",
    title_ar: "دليل الفني المهني في الأشعة",
    title_en: "Radiology Technician Career Guide",
    category: "Career",
    price: 7.99
  },
  {
    cover_ar: "tareekh-ashiaa-roentgen-ai-ar.png",
    pdf_ar: "radiology-career-guide-ar.pdf",
    cover_en: "history-radiology-roentgen-ai-en.png",
    pdf_en: "history-radiology-roentgen-ai-en.pdf",
    title_ar: "تاريخ الأشعة: من رونتجن إلى الذكاء الاصطناعي",
    title_en: "History of Radiology: Roentgen to AI",
    category: "History",
    price: 9.99
  },
  {
    cover_ar: "mri-cover-ar.jpg",
    pdf_ar: "mri-made-easy-ar-final.pdf",
    cover_en: "mri-made-easy-en.jpg",
    pdf_en: "mri-made-easy-en-final.pdf",
    title_ar: "الرنين المغناطيسي بسهولة",
    title_en: "MRI Made Easy",
    category: "MRI",
    price: 12.99
  },
  {
    cover_ar: "positioning-made-easy-ar.jpg",
    pdf_ar: "positioning-made-easy-ar-final-100-arabic.pdf",
    cover_en: "positioning-made-easy-en.jpg",
    pdf_en: "positioning-made-easy-en.pdf",
    title_ar: "تموضع المريض في الأشعة بسهولة",
    title_en: "Positioning Made Easy",
    category: "Positioning",
    price: 14.99
  },
  {
    cover_ar: "rs-cover-ar.jpg",
    pdf_ar: "radiation-protection-ar-final.pdf",
    cover_en: "rs-cover-en.jpg",
    pdf_en: "radiation-protection-en-final.pdf",
    title_ar: "الوقاية من الإشعاع",
    title_en: "Radiation Protection",
    category: "Safety",
    price: 11.99
  },
  {
    cover_ar: "radiology-dictionary-illustrated-ar.jpg",
    pdf_ar: "radiology-dictionary-ct-terminology-ar.pdf",
    cover_en: "radiology-dictionary-ct-terminology-en.png",
    pdf_en: "radiology-dictionary-ct-terminology-en.pdf",
    title_ar: "قاموس مصطلحات الأشعة المقطعية",
    title_en: "CT Terminology Dictionary",
    category: "Reference",
    price: 8.99
  },
  {
    cover_ar: "qamoos-ashiaa-mustalahat-ar.png",
    pdf_ar: "qamoos-ashiaa-mustalahat-ar.pdf",
    cover_en: "radiology-dictionary-en.jpg",
    pdf_en: "radiology-dictionary-en.pdf",
    title_ar: "قاموس الأشعة المصور",
    title_en: "Illustrated Radiology Dictionary",
    category: "Reference",
    price: 9.99
  },
  {
    cover_ar: "radiology-flashcards-ar.jpg",
    pdf_ar: "radiology-flashcards-ar.pdf",
    cover_en: "flashcards-en.jpg",
    pdf_en: "flashcards-en.pdf",
    title_ar: "بطاقات الأشعة التعليمية",
    title_en: "Radiology Flashcards",
    category: "Study Aids",
    price: 5.99
  },
  {
    cover_ar: "mri-ar.jpg",
    pdf_ar: "ultrasound-made-easy-ar-final.pdf",
    cover_en: "mri-cover-en.jpg",
    pdf_en: "ultrasound-made-easy-en-final.pdf",
    title_ar: "الموجات فوق الصوتية بسهولة",
    title_en: "Ultrasound Made Easy",
    category: "Ultrasound",
    price: 12.99
  }
];

async function seedDatabase() {
  console.log(" بدء عملية ربط 17 كتاباً (34 منتجاً) بقاعدة البيانات...\n");
  console.log(`🔗 متصل بـ: ${url.substring(0, 50)}...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const book of books) {
    const arCoverUrl = `${projectUrl}/storage/v1/object/public/covers/ar/${book.cover_ar}`;
    const arPdfUrl = `${projectUrl}/storage/v1/object/public/pdfs/ar/${book.pdf_ar}`;
    const enCoverUrl = `${projectUrl}/storage/v1/object/public/covers/en/${book.cover_en}`;
    const enPdfUrl = `${projectUrl}/storage/v1/object/public/pdfs/en/${book.pdf_en}`;

    const { error: arError } = await supabase.from('products').insert({
      title_ar: book.title_ar,
      title_en: book.title_en,
      category: book.category,
      price: book.price,
      cover_url: arCoverUrl,
      pdf_url: arPdfUrl,
      language: 'ar'
    });

    const { error: enError } = await supabase.from('products').insert({
      title_ar: book.title_ar,
      title_en: book.title_en,
      category: book.category,
      price: book.price,
      cover_url: enCoverUrl,
      pdf_url: enPdfUrl,
      language: 'en'
    });

    if (arError || enError) {
      failCount++;
      console.log(`❌ فشل: ${book.title_en}`);
      if (arError) console.log(`   عربي: ${arError.message}`);
      if (enError) console.log(`   إنجليزي: ${enError.message}`);
    } else {
      successCount++;
      console.log(`✅ نجح: ${book.title_ar} / ${book.title_en}`);
    }
  }

  console.log(`\n🎉 انتهت العملية!`);
  console.log(`   ✅ نجح: ${successCount} كتاب (${successCount * 2} منتج)`);
  console.log(`   ❌ فشل: ${failCount} كتاب`);
  console.log(`\n👉 تحقق من: Supabase > Table Editor > products`);
}

seedDatabase();
