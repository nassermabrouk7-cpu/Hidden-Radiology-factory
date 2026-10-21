// Test /api/publish-all endpoint
const API_URL = 'http://localhost:3000/api/publish-all';
const PRODUCTION_URL = 'https://hidden-radiology-project-chi.vercel.app/api/publish-all';

// Test data (use a real product from your database)
const testData = {
  bookId: 'test-book-001',
  campaignType: 'manual_test',
  imageUrl: 'https://hidden-radiology-project-chi.vercel.app/logos/hr-icon.png',
  price: 15,
  description_ar: 'مرجع متخصص في الأشعة للطلاب والأطباء',
  description_en: 'Specialized radiology reference for students and doctors',
  title_ar: 'أنا فاهم أشعة',
  title_en: 'I Understand Radiology'
};

async function testPublishAPI() {
  console.log('Testing /api/publish-all endpoint...');
  console.log('URL:', PRODUCTION_URL);
  console.log('Data:', JSON.stringify(testData, null, 2));
  console.log('');

  try {
    const response = await fetch(PRODUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('');
      console.log('✅ PUBLISH TEST SUCCESSFUL');
      console.log('Summary:');
      console.log('  Total channels:', result.summary.total);
      console.log('  Succeeded:', result.summary.succeeded);
      console.log('  Failed:', result.summary.failed);
      console.log('');
      console.log('Per-channel results:');
      result.results.forEach(r => {
        console.log(`  ${r.channel}: ${r.success ? '✅' : '❌'} ${r.message}`);
        if (r.error) console.log(`    Error: ${r.error}`);
        if (r.externalId) console.log(`    External ID: ${r.externalId}`);
        if (r.note) console.log(`    Note: ${r.note}`);
      });
    } else {
      console.log('');
      console.log('❌ PUBLISH TEST FAILED');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

testPublishAPI();
