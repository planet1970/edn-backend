const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch'); // we can use global fetch if Node 18+

async function run() {
  const prisma = new PrismaClient();
  
  try {
    const account = await prisma.socialMediaAccount.findFirst({
      where: { platform: 'INSTAGRAM', isActive: true },
    });
    
    if (!account) {
      console.log("No active INSTAGRAM account found in DB.");
      return;
    }
    
    console.log("Found account:", account.username);
    const creds = account.credentials || {};
    const accessToken = creds.accessToken;
    const igId = creds.instagramBusinessAccountId;
    
    if (!accessToken || !igId) {
      console.log("Missing accessToken or instagramBusinessAccountId");
      return;
    }
    
    console.log("Token:", accessToken.substring(0, 15) + "...");
    console.log("IG Business Account ID from DB:", igId);
    
    console.log("\n--- Checking Facebook Pages and Linked IG Accounts ---");
    const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?fields=name,instagram_business_account&access_token=${accessToken}`);
    const pagesData = await pagesRes.json();
    console.log(JSON.stringify(pagesData, null, 2));
    
    // Test a basic media container creation with the LIVE image
    const imageUrl = "https://api.edirnego.com/uploads/social-image-1781858396780.jpg";
    
    console.log("\n--- Creating media container... ---");
    const url = `https://graph.facebook.com/v18.0/${igId}/media`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: "Test post for debugging",
        access_token: accessToken,
      })
    });
    
    const data = await res.json();
    console.log("Container Response:", data);
    
    if (data.id) {
      console.log("Polling status for container:", data.id);
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 4000));
        const statusRes = await fetch(`https://graph.facebook.com/v18.0/${data.id}?fields=status_code,status&access_token=${accessToken}`);
        const statusData = await statusRes.json();
        console.log(`Poll ${i+1}:`, statusData);
        if (statusData.status_code === 'FINISHED' || statusData.status_code === 'ERROR') {
          break;
        }
      }
    }
    
  } catch (err) {
    console.error("Script error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
