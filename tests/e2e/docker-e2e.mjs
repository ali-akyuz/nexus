import { setTimeout } from 'timers/promises';

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function runE2E() {
  console.log('--- Starting Real Docker E2E Test ---');
  
  // 1. Register User
  const email = `test-${Date.now()}@example.com`;
  const password = 'password123';
  console.log(`Registering user ${email}...`);
  
  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Test User' })
  });
  if (!regRes.ok) throw new Error(`Registration failed: ${await regRes.text()}`);
  
  // 2. Login
  console.log('Logging in...');
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`);
  
  const { accessToken } = await loginRes.json();
  const authHeader = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  // 3. Create DATA_ANALYSIS job
  console.log('Creating DATA_ANALYSIS job...');
  const jobRes = await fetch(`${API_URL}/api/jobs`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      type: 'DATA_ANALYSIS',
      payload: { data: 'test dataset' }
    })
  });
  if (!jobRes.ok) throw new Error(`Job creation failed: ${await jobRes.text()}`);
  
  const job = await jobRes.json();
  const jobId = job.id;
  console.log(`Job created: ${jobId}, Initial status: ${job.status}`);

  // 4. Poll for completion
  console.log('Waiting for job to be processed by worker and ML service...');
  let currentStatus = job.status;
  let attempts = 0;
  
  while (currentStatus !== 'COMPLETED' && currentStatus !== 'FAILED') {
    if (attempts > 30) throw new Error('Timeout waiting for job completion');
    await setTimeout(2000);
    
    const checkRes = await fetch(`${API_URL}/api/jobs/${jobId}`, { headers: authHeader });
    if (!checkRes.ok) throw new Error(`Failed to fetch job status: ${await checkRes.text()}`);
    
    const checkData = await checkRes.json();
    if (checkData.status !== currentStatus) {
      console.log(`Job status changed: ${currentStatus} -> ${checkData.status}`);
      currentStatus = checkData.status;
    }
    attempts++;
  }

  // 5. Verify result
  if (currentStatus === 'FAILED') {
    throw new Error('Job FAILED during E2E test');
  }

  const finalRes = await fetch(`${API_URL}/api/jobs/${jobId}`, { headers: authHeader });
  const finalData = await finalRes.json();
  
  if (!finalData.result) {
    throw new Error('Job completed but no result found!');
  }
  
  console.log('Job Result:', finalData.result);
  console.log('--- Real Docker E2E Test Passed ---');
}

runE2E().catch(err => {
  console.error(err);
  process.exit(1);
});
