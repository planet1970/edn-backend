async function checkUrls() {
  const urls = [
    'https://api.edirnego.com/uploads/manual-image-1781877935163.png',
    'https://api.edirnego.com/uploads/manual-image-1781877935163-story.png'
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      console.log(`${url} => Status: ${res.status}`);
    } catch (e) {
      console.log(`${url} => Error: ${e.message}`);
    }
  }
}
checkUrls();
