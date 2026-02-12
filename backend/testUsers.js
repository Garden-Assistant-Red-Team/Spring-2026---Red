const http = require('http');

// Helper function to make requests
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
  console.log('--- Testing Users Endpoints ---\n');

  // Test 1: Register a new user
  console.log('Test 1: Register a new user...');
  const registerData = JSON.stringify({
    name: 'Jane Doe',
    email: 'janedoe@test.com',
    password: 'password123'
  });
  const newUser = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': registerData.length }
  }, registerData);
  console.log('Result:', newUser);
  console.log('');

  // Save user ID for next tests
  const userId = newUser.user?.id;
  if (!userId) {
    console.log('Could not get user ID, stopping tests');
    return;
  }

  // Test 2: Get user info
  console.log('Test 2: Get user info...');
  const userInfo = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/users/${userId}`,
    method: 'GET'
  });
  console.log('Result:', userInfo);
  console.log('');

  // Test 3: Add a plant to user's collection
  console.log('Test 3: Add a plant to user collection...');
  const plantData = JSON.stringify({
    name: 'Sunflower',
    species: 'Helianthus annuus',
    wateringFrequency: 'Every 3 days',
    sunlight: 'Full sun',
    notes: 'Grows tall!'
  });
  const addedPlant = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/users/${userId}/plants`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': plantData.length }
  }, plantData);
  console.log('Result:', addedPlant);
  console.log('');

  // Test 4: Get user's plants
  console.log('Test 4: Get user plants...');
  const userPlants = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/users/${userId}/plants`,
    method: 'GET'
  });
  console.log('Result:', userPlants);
  console.log('');

  // Test 5: Update user
  console.log('Test 5: Update user name...');
  const updateData = JSON.stringify({ name: 'Jane Smith' });
  const updatedUser = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/users/${userId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Content-Length': updateData.length }
  }, updateData);
  console.log('Result:', updatedUser);
  console.log('');

  console.log('--- All Tests Done! ---');
}

runTests();