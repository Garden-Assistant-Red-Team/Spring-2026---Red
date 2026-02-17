const http = require('http');

const data = JSON.stringify({
  name: 'Tomato Plant',
  species: 'Solanum lycopersicum',
  wateringFrequency: 'Daily',
  sunlight: 'Full sun',
  notes: 'Planted in backyard'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/plants',
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