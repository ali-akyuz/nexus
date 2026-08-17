import { setTimeout } from 'timers/promises';

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function runFailureTest() {
  console.log('--- Starting Failure Recovery Test ---');
  
  // 1. Register & Login User
  const email = `failtest-${Date.now()}@example.com`;
  const password = 'password123';
  
  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Fail Tester' })
  });
  if (!regRes.ok) throw new Error(`Registration failed: ${await regRes.text()}`);
  
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const { accessToken } = await loginRes.json();
  const authHeader = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  // 2. Create job while ML is down
  console.log('Creating job to fail...');
  const jobRes = await fetch(`${API_URL}/api/jobs`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ type: 'DATA_ANALYSIS', payload: { data: 'fail data' } })
  });
  const job = await jobRes.json();
  const jobId = job.id;
  
  // 3. Wait for it to fail/retry
  let currentStatus = job.status;
  let attempts = 0;
  console.log(`Waiting for job ${jobId} to fail...`);
  
  while (currentStatus !== 'FAILED' && currentStatus !== 'QUEUED') {
    if (attempts > 30) throw new Error('Timeout waiting for job failure/retry state');
    await setTimeout(2000);
    
    const checkRes = await fetch(`${API_URL}/api/jobs/${jobId}`, { headers: authHeader });
    const checkData = await checkRes.json();
    
    if (checkData.status !== currentStatus) {
      console.log(`Job status changed: ${currentStatus} -> ${checkData.status}, Error: ${checkData.error || 'none'}`);
      currentStatus = checkData.status;
      if (currentStatus === 'FAILED' || (currentStatus === 'QUEUED' && checkData.error)) {
        break; // Successfully recorded failure
      }
    }
    attempts++;
  }
  
  console.log('--- Failure Recovery Test Passed ---');
}

runFailureTest().catch(err => {
  console.error(err);
  process.exit(1);
});
