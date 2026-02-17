const http = require('http');

const data = JSON.stringify({
  name: 'Test User',
  email: 'testuser@test.com',
  password: 'password123'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/users/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let response = '';
  res.on('data', (chunk) => {
    response += chunk;
  });
  res.on('end', () => {
    console.log(JSON.parse(response));
  });
});

req.write(data);
req.end();