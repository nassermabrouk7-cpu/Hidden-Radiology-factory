// Test if we can use Facebook Page Access Token for Instagram
require('dotenv').config({ path: '.env.local' });

const facebookPageId = process.env.FACEBOOK_PAGE_ID;
const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

console.log('🔍 Testing Instagram with Facebook Page Access Token');
console.log('====================================================\n');

async function testInstagramWithFacebookToken() {
  try {
    // Get Instagram Business Account ID from Facebook Page
    console.log('📡 Step 1: Get Instagram Business Account from Facebook Page...');
    const response1 = await fetch(`https://graph.facebook.com/v18.0/${facebookPageId}?fields=instagram_business_account{id,username}&access_token=${accessToken}`, {
      signal: AbortSignal.timeout(15000)
    });
    const data1 = await response1.json();
    console.log('Response:', JSON.stringify(data1, null, 2));

    if (data1.instagram_business_account && data1.instagram_business_account.id) {
      const igId = data1.instagram_business_account.id;
      console.log('\n✅ Instagram Business Account ID:', igId);
      console.log('Username:', data1.instagram_business_account.username);

      // Try to get Instagram user info using Facebook token
      console.log('\n📡 Step 2: Test if Facebook token can access Instagram...');
      const response2 = await fetch(`https://graph.facebook.com/v18.0/${igId}?fields=username,media_count&access_token=${accessToken}`, {
        signal: AbortSignal.timeout(15000)
      });
      const data2 = await response2.json();
      console.log('Response:', JSON.stringify(data2, null, 2));

      if (data2.username) {
        console.log('\n✅ SUCCESS! Facebook Page Access Token can access Instagram');
        console.log('   Username:', data2.username);
        console.log('   Media Count:', data2.media_count);
        console.log('\n💡 This means we might not need a separate Instagram Access Token');
        console.log('   The system may already work with Facebook Page Access Token');
      } else {
        console.log('\n⚠️ Facebook token cannot access Instagram directly');
        console.log('   You still need an Instagram Access Token');
      }
    } else {
      console.log('\n⚠️ Instagram Business Account not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testInstagramWithFacebookToken();
