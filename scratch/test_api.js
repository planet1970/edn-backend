const fetch = require('node-fetch'); // wait, node 18+ has global fetch, but let's check if we can just use global fetch

async function test() {
  console.log("Connecting to backend...");
  try {
    const res = await fetch("https://api.edirnego.com/uploads/social-image-1781786146356.jpg", {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });
    console.log("Status code:", res.status);
    const text = await res.text();
    console.log("Response text length:", text.length);
    console.log("First 200 chars:", text.slice(0, 200));
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

test();
