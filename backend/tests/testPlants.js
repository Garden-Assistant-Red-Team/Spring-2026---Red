const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let response = '';
      res.on('data', (chunk) => { response += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(response));
        } catch (e) {
          resolve(response);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- Testing Plants Endpoints ---\n');

  // Test 1: Add a plant
  console.log('Test 1: Add a plant...');
  const plantData = JSON.stringify({
    name: 'Rose',
    species: 'Rosa rubiginosa',
    wateringFrequency: 'Every 2 days',
    sunlight: 'Full sun',
    notes: 'Beautiful red roses'
  });
  const newPlant = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/plants',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': plantData.length }
  }, plantData);
  console.log('Result:', newPlant);
  console.log('');

  // Save plant ID for next tests
  const plantId = newPlant.id;
  if (!plantId) {
    console.log('Could not get plant ID, stopping tests');
    return;
  }

  // Test 2: Get all plants
  console.log('Test 2: Get all plants...');
  const allPlants = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/plants',
    method: 'GET'
  });
  console.log('Result:', allPlants);
  console.log('');

  // Test 3: Get specific plant
  console.log('Test 3: Get specific plant...');
  const specificPlant = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/plants/${plantId}`,
    method: 'GET'
  });
  console.log('Result:', specificPlant);
  console.log('');

  // Test 4: Update plant
  console.log('Test 4: Update plant...');
  const updateData = JSON.stringify({ 
    wateringFrequency: 'Every 3 days',
    notes: 'Updated notes'
  });
  const updatedPlant = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/plants/${plantId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Content-Length': updateData.length }
  }, updateData);
  console.log('Result:', updatedPlant);
  console.log('');

  // Test 5: Delete plant
  console.log('Test 5: Delete plant...');
  const deletedPlant = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/plants/${plantId}`,
    method: 'DELETE'
  });
  console.log('Result:', deletedPlant);
  console.log('');

  console.log('--- All Tests Done! ---');
}

runTests();