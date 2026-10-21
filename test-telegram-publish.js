// Test Telegram Bot Publishing
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = '-5416713273';

async function testTelegramBot() {
  if (!BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is missing from the environment.');
    process.exitCode = 1;
    return;
  }
  console.log('Testing Telegram Bot Identity...');
  console.log('Chat ID:', CHAT_ID);
  console.log('');

  // Step 1: Get bot info
  console.log('Step 1: Getting bot info...');
  const botInfoResponse = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
  );
  const botInfo = await botInfoResponse.json();

  if (botInfo.ok) {
    console.log('✅ Bot Info:');
    console.log('   Username:', botInfo.result.username);
    console.log('   First Name:', botInfo.result.first_name);
    console.log('   ID:', botInfo.result.id);
  } else {
    console.log('❌ Failed to get bot info:', botInfo.description);
    return;
  }

  console.log('');

  // Step 2: Send test message
  console.log('Step 2: Sending test message...');
  const testMessage = `🧪 Test from Hidden Radiology Factory\n\nBot: @${botInfo.result.username}\nChannel ID: ${CHAT_ID}\n\n✅ Telegram integration test successful!`;

  const messageResponse = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: testMessage,
        parse_mode: 'HTML'
      })
    }
  );

  const messageData = await messageResponse.json();

  if (messageData.ok) {
    console.log('✅ Message sent successfully!');
    console.log('   Message ID:', messageData.result.message_id);
    console.log('   Chat ID:', messageData.result.chat.id);
    console.log('   Chat Title:', messageData.result.chat.title);
  } else {
    console.log('❌ Failed to send message:', messageData.description);
    console.log('   Error Code:', messageData.error_code);
  }

  console.log('');

  // Step 3: Send test photo with inline button
  console.log('Step 3: Sending test photo with Buy button...');
  const testPhotoUrl = 'https://hidden-radiology-project-chi.vercel.app/logos/hr-icon.png';
  const testCaption = '📚 Hidden Radiology\n\nSpecialized radiology references for medical students and professionals.\n\nTap below to browse our library!';

  const photoResponse = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        photo: testPhotoUrl,
        caption: testCaption,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🛒 Browse Library',
              url: 'https://hidden-radiology-project-chi.vercel.app/library'
            }
          ]]
        }
      })
    }
  );

  const photoData = await photoResponse.json();

  if (photoData.ok) {
    console.log('✅ Photo sent successfully!');
    console.log('   Message ID:', photoData.result.message_id);
    console.log('   Photo Size:', photoData.result.photo?.[0]?.file_size);
  } else {
    console.log('❌ Failed to send photo:', photoData.description);
    console.log('   Error Code:', photoData.error_code);
  }

  console.log('');
  console.log('========================================');
  console.log('TELEGRAM TEST COMPLETE');
  console.log('========================================');
}

testTelegramBot().catch(console.error);
