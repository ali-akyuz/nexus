import { PrismaClient, JobStatus, JobPriority, Role } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting deterministic seed for historical data...');

  // Create a default admin user and standard user for testing
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const adminId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';

  await prisma.user.upsert({
    where: { email: 'admin@nexus.local' },
    update: {},
    create: {
      id: adminId,
      email: 'admin@nexus.local',
      firstName: 'Admin',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const testUser = await prisma.user.upsert({
    where: { email: 'user@nexus.local' },
    update: {},
    create: {
      id: userId,
      email: 'user@nexus.local',
      firstName: 'Test User',
      passwordHash,
      role: Role.USER,
    },
  });

  // Create some workers
  const worker1Id = '33333333-3333-3333-3333-333333333333';
  const worker2Id = '44444444-4444-4444-4444-444444444444';

  await prisma.workerNode.upsert({
    where: { name: 'processor-alpha' },
    update: {},
    create: { id: worker1Id, name: 'processor-alpha', status: 'IDLE' },
  });
  
  await prisma.workerNode.upsert({
    where: { name: 'processor-beta' },
    update: {},
    create: { id: worker2Id, name: 'processor-beta', status: 'OFFLINE' },
  });

  // Clear existing jobs to ensure deterministic state (optional, but good for reliable local testing)
  await prisma.job.deleteMany({
    where: {
      userId: { in: [adminId, userId] }
    }
  });

  console.log('Generating 90 days of historical jobs...');

  // Deterministic random logic
  let seed = 12345;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const jobTypes = ['DATA_ANALYSIS', 'CUSTOMER_SEGMENTATION', 'CREDIT_RISK'];
  const now = new Date();
  
  const jobsToInsert = [];

  // Generate 500 jobs spread over the last 90 days
  for (let i = 0; i < 500; i++) {
    const daysAgo = Math.floor(rand() * 90);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - rand() * 24 * 60 * 60 * 1000);
    
    // Most jobs complete, some fail, few cancel, few processing
    const statusRoll = rand();
    let status: JobStatus = JobStatus.COMPLETED;
    if (statusRoll > 0.85) status = JobStatus.FAILED;
    else if (statusRoll > 0.8) status = JobStatus.CANCELLED;
    else if (statusRoll > 0.78 && daysAgo === 0) status = JobStatus.PROCESSING;
    else if (statusRoll > 0.76 && daysAgo === 0) status = JobStatus.QUEUED;

    const type = jobTypes[Math.floor(rand() * jobTypes.length)];
    const priority = rand() > 0.8 ? JobPriority.HIGH : JobPriority.NORMAL;
    
    // Simulate wait time in queue (e.g., 2-30 seconds)
    const waitTimeMs = Math.floor(rand() * 28000) + 2000;
    const startedAt = (status !== JobStatus.QUEUED && status !== JobStatus.CANCELLED) 
      ? new Date(createdAt.getTime() + waitTimeMs) 
      : null;
      
    // Simulate processing duration based on type
    let processingMs = 0;
    if (type === 'DATA_ANALYSIS') processingMs = 5000 + rand() * 10000;
    if (type === 'CUSTOMER_SEGMENTATION') processingMs = 15000 + rand() * 20000;
    if (type === 'CREDIT_RISK') processingMs = 2000 + rand() * 4000;

    const completedAt = (status === JobStatus.COMPLETED || status === JobStatus.FAILED)
      ? new Date(startedAt!.getTime() + processingMs)
      : null;

    jobsToInsert.push({
      id: crypto.randomUUID(),
      userId: rand() > 0.2 ? testUser.id : adminId,
      type,
      status,
      priority,
      createdAt,
      startedAt,
      completedAt,
      workerId: (startedAt) ? (rand() > 0.5 ? worker1Id : worker2Id) : null,
      progress: status === JobStatus.COMPLETED ? 100 : (status === JobStatus.PROCESSING ? Math.floor(rand() * 90) : 0),
      payload: { instruction: 'deterministic-seed' },
      result: status === JobStatus.COMPLETED ? { success: true, processedAt: completedAt?.toISOString() } : null,
      error: status === JobStatus.FAILED ? 'Simulated processing error' : null,
    });
  }

  // Insert in chunks
  console.log(`Inserting ${jobsToInsert.length} jobs...`);
  await prisma.job.createMany({
    data: jobsToInsert,
  });

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
