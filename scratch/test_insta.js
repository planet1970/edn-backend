const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch'); // wait, let's use global fetch since node 18+ has it
const prisma = new PrismaClient();

async function main() {
  console.log("Fetching Instagram account credentials...");
  const account = await prisma.socialMediaAccount.findFirst({
    where: { platform: 'INSTAGRAM', isActive: true },
  });

  if (!account) {
    console.error("No active Instagram account found in database!");
    return;
  }

  const credentials = account.credentials;
  const accessToken = credentials?.accessToken?.trim();
  const pageId = credentials?.pageId?.trim();
  let instagramBusinessAccountId = credentials?.instagramBusinessAccountId;

  console.log("Account Username:", account.username);
  console.log("Page ID:", pageId);
  console.log("Instagram Business Account ID:", instagramBusinessAccountId);
  
  if (!accessToken) {
    console.error("Access Token is missing!");
    return;
  }

  // 1. If we don't have instagramBusinessAccountId, retrieve it
  if (!instagramBusinessAccountId && pageId) {
    console.log("Retrieving Instagram Business Account ID on the fly...");
    const pageInfoRes = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
    );
    const pageInfo = await pageInfoRes.json();
    console.log("Page Info Response:", JSON.stringify(pageInfo, null, 2));
    instagramBusinessAccountId = pageInfo?.instagram_business_account?.id;
  }

  if (!instagramBusinessAccountId) {
    console.error("Could not find Instagram Business Account ID!");
    return;
  }

  const imageUrl = "https://api.edirnego.com/uploads/social-image-1781786146356.jpg";
  const caption = "Test post from Antigravity diagnostic script.";

  console.log("\n--- Creating Media Container ---");
  const mediaContainerUrl = `https://graph.facebook.com/v18.0/${instagramBusinessAccountId}/media`;
  const containerBody = {
    image_url: imageUrl,
    caption: caption,
    access_token: accessToken,
  };

  console.log("Sending POST to:", mediaContainerUrl);
  const containerRes = await fetch(mediaContainerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(containerBody),
  });

  const containerData = await containerRes.json();
  console.log("Container Response:", JSON.stringify(containerData, null, 2));

  if (!containerRes.ok) {
    console.error("Failed to create container!");
    return;
  }

  const creationId = containerData.id;
  console.log("Container created successfully. ID:", creationId);

  console.log("\n--- Polling Container Status ---");
  let status = 'IN_PROGRESS';
  let attempts = 0;
  const maxAttempts = 10; // Let's check 10 times (50 seconds) for diagnosis

  while (attempts < maxAttempts) {
    console.log(`Checking status (Attempt ${attempts + 1}/${maxAttempts})...`);
    const checkRes = await fetch(
      `https://graph.facebook.com/v18.0/${creationId}?fields=status_code,status_message,id&access_token=${accessToken}`
    );
    const checkData = await checkRes.json();
    console.log("Poll Response:", JSON.stringify(checkData, null, 2));
    
    if (checkRes.ok) {
      status = checkData.status_code;
      if (status === 'FINISHED') {
        console.log("Container is FINISHED and ready to publish!");
        break;
      }
      if (status === 'ERROR') {
        console.error("Container failed processing with error:", checkData.status_message);
        break;
      }
    } else {
      console.warn("Status check request failed!");
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log("\nDiagnostic finished.");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
