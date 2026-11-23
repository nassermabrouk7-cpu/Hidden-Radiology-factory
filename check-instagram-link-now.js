// Check Instagram link now (after user confirmed linking)
require('dotenv').config({ path: '.env.local' });

const facebookPageId = process.env.FACEBOOK_PAGE_ID;
const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

console.log('🔍 Checking Instagram Link (after user confirmed linking)');
console.log('=========================================================\n');

async function checkLink() {
  try {
    console.log('📡 Checking instagram_business_account field...');
    const response = await fetch(`https://graph.facebook.com/v18.0/${facebookPageId}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`, {
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.instagram_business_account && data.instagram_business_account.id) {
      const igId = data.instagram_business_account.id;
      console.log('\n🎉 SUCCESS! Instagram Business Account ID:', igId);
      console.log('Username:', data.instagram_business_account.username);

      // Validate the ID
      if (/^\d{10,20}$/.test(igId)) {
        console.log('\n✅ ID format is valid (10-20 digits)');
        console.log('\n💡 Ready to update in Vercel');
        console.log('   INSTAGRAM_BUSINESS_ACCOUNT_ID =', igId);
        return igId;
      } else {
        console.log('\n⚠️ ID format is not valid');
        console.log('   Expected: 10-20 digits');
        console.log('   Got:', igId);
      }
    } else {
      console.log('\n⚠️ Instagram Business Account not found in response');
      console.log('💡 The link may not be visible to the API yet');
      console.log('💡 Or the access token may not have the right permissions');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkLink();
