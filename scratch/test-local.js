
const http = require('http');

http.get('http://localhost:3000/uploads/profiles/1777451092206-650428193.png', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.resume();
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});

http.get('http://localhost:3000/api/v1/media/list', (res) => {
  console.log(`MEDIA LIST STATUS: ${res.statusCode}`);
  res.resume();
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
