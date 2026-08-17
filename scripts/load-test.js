// A simple load test script to verify API Rate Limiting and Back-Pressure behavior.
// Usage: node scripts/load-test.js

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const LOGIN_URL = `${API_URL}/api/auth/login`;
const JOBS_URL = `${API_URL}/api/jobs`;

// Use existing test user from seed
const email = 'user@nexus.local';
const password = 'password123';

async function run() {
  console.log('--- NEXUS Load Test ---');
  
  try {
    // 1. Authenticate
    console.log(`Authenticating as ${email}...`);
    const authRes = await axios.post(LOGIN_URL, { email, password });
    const token = authRes.data.accessToken;
    console.log('Authenticated successfully.\n');

    // 2. Submit jobs rapidly
    console.log('Spamming 30 job requests to test Concurrency and Rate Limits...');
    const requests = [];
    
    for (let i = 1; i <= 30; i++) {
      requests.push(
        axios.post(
          JOBS_URL,
          {
            type: 'DATA_ANALYSIS',
            payload: { instruction: `Load Test Job ${i}` }
          },
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(() => {
          console.log(`Job ${i} Accepted (201)`);
        }).catch((err) => {
          if (err.response) {
            console.log(`Job ${i} Rejected (${err.response.status}):`, err.response.data.message || err.response.data);
          } else {
            console.log(`Job ${i} Failed:`, err.message);
          }
        })
      );
    }

    await Promise.all(requests);
    console.log('\nLoad test finished.');
  } catch (error) {
    console.error('Fatal error during load test:', error.response ? error.response.data : error.message);
  }
}

run();
