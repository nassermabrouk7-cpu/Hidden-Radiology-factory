cd E:\hidden-radiology-factory

$scriptContent = @"
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
const url = lines.find(l => l.includes('SUPABASE_URL'))?.split('=')[1]?.trim();
const key = lines.find(l => l.includes('SERVICE_ROLE'))?.split('=')[1]?.trim();

const supabase = createClient(url, key);

const LOCAL_BOOKS_PATH = 'E:\\hidden-radiology-factory\\books';
const LOCAL_COVERS_PATH = 'E:\\hidden-radiology-factory\\public\\covers';

async function uploadFiles() {
  console.log('🚀 بدء رفع الملفات إلى Supabase...\n');
  
  let uploadedCount = 0;
  let failedCount = 0;

  console.log('📤 جاري رفع الأغلفة...');
  if (fs.existsSync(LOCAL_COVERS_PATH)) {
    const items = fs.readdirSync(LOCAL_COVERS_PATH);
    for (const item of items) {
      if (item.startsWith('.')) continue;
      
      const filePath = path.join(LOCAL_COVERS_PATH, item);
      
      // ✅ الإصلاح: التحقق من أن العنصر هو ملف وليس مجلداً
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        console.log('⚠️ تم تخطي مجلد: ' + item);
        continue;
      }

      const fileContent = fs.readFileSync(filePath);
      const targetFolder = item.includes('-ar') || item.includes('_ar') ? 'ar' : 'en';
      const targetPath = targetFolder + '/' + item;
      
      const { error } = await supabase.storage.from('covers').upload(targetPath, fileContent, { upsert: true });
      if (error) {
        console.log('❌ فشل رفع الغلاف: ' + item + ' - ' + error.message);
        failedCount++;
      } else {
        console.log('✅ تم رفع الغلاف: ' + targetPath);
        uploadedCount++;
      }
    }
  } else {
    console.log('⚠️ مجلد الأغلفة غير موجود: ' + LOCAL_COVERS_PATH);
  }

  console.log('\n📤 جاري رفع ملفات PDF...');
  const pdfFolders = [
    { name: 'mine-original-arabic', target: 'ar' },
    { name: 'mine-original-english', target: 'en' },
    { name: 'translated-arabic', target: 'ar' },
    { name: 'translated-english', target: 'en' }
  ];

  for (const folder of pdfFolders) {
    const folderPath = path.join(LOCAL_BOOKS_PATH, folder.name);
    if (!fs.existsSync(folderPath)) {
      console.log('⚠️ المجلد غير موجود: ' + folder.name);
      continue;
    }
    
    const pdfFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.pdf'));
    for (const file of pdfFiles) {
      const filePath = path.join(folderPath, file);
      
      // ✅ الإصلاح: التحقق من أن العنصر هو ملف
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) continue;

      const fileContent = fs.readFileSync(filePath);
      const targetPath = folder.target + '/' + file;
      
      const { error } = await supabase.storage.from('pdfs').upload(targetPath, fileContent, { upsert: true });
      if (error) {
        console.log('❌ فشل رفع الـ PDF: ' + file + ' - ' + error.message);
        failedCount++;
      } else {
        console.log('✅ تم رفع الـ PDF: ' + targetPath);
        uploadedCount++;
      }
    }
  }

  console.log('\n🎉 انتهت عملية الرفع!');
  console.log('   ✅ تم رفع: ' + uploadedCount + ' ملف');
  console.log('   ❌ فشل: ' + failedCount + ' ملف');
}

uploadFiles();
"@

Set-Content -Path "upload-files.js" -Value $scriptContent -Encoding utf8
Write-Host "✅ تم تحديث السكريبت بنجاح ليتجاهل المجلدات!" -ForegroundColor Green