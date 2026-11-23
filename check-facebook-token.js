// Check Facebook Page Access Token
require('dotenv').config({ path: '.env.local' });

const facebookPageId = process.env.FACEBOOK_PAGE_ID;
const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

console.log('🔍 Checking Facebook Page Access Token');
console.log('=====================================\n');

async function checkToken() {
  try {
    console.log('📡 Testing with Facebook Graph API...');
    const response = await fetch(`https://graph.facebook.com/v18.0/${facebookPageId}?fields=name&access_token=${accessToken}`, {
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.error) {
      console.log('\n❌ Facebook Token is invalid or expired');
      console.log('Error:', data.error.message);
      console.log('\n💡 You need to get a new Facebook Page Access Token');
      console.log('   1. Go to: https://developers.facebook.com/tools/explorer/');
      console.log('   2. Get a new User Access Token with page permissions');
      console.log('   3. Get Page Access Token from /me/accounts');
      console.log('   4. Update FACEBOOK_PAGE_ACCESS_TOKEN in Vercel');
    } else {
      console.log('\n✅ Facebook Token is valid');
      console.log('Page Name:', data.name);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkToken();
