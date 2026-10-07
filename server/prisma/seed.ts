import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting PayPal Guardian database seed...');

  // Clean existing demo data
  await prisma.auditEvent.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.payPalOrder.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transactionProposal.deleteMany();
  await prisma.policyVersion.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seed Demo User
  const demoUser = await prisma.user.create({
    data: {
      id: 'usr_demo_shopper',
      email: 'shopper@paypalguardian.com',
      name: 'Alex Shopper'
    }
  });
  console.log(`👤 Created Demo User: ${demoUser.name} (${demoUser.email})`);

  // 2. Seed Default Running Shoes Policy
  const defaultRules = {
    max_amount: 8000,
    currency: 'INR',
    max_quantity: 1,
    allowed_categories: ['running_shoes'],
    blocked_categories: ['subscription', 'gambling', 'adult'],
    allowed_merchants: [],
    blocked_merchants: ['scamstore.com'],
    recurring_allowed: false,
    approval_required: true,
    recheck_on_change: true
  };

  const defaultPolicy = await prisma.policy.create({
    data: {
      id: 'pol_running_shoes_default',
      userId: demoUser.id,
      name: 'Running Shoes Protection Policy',
      description: 'Auto-purchase running shoes under ₹8,000 without subscriptions. Human confirmation required.',
      status: 'ACTIVE',
      versions: {
        create: {
          version: 1,
          rulesJson: JSON.stringify(defaultRules)
        }
      }
    }
  });
  console.log(`🛡️ Created Baseline Policy: ${defaultPolicy.name} (v1)`);

  // 3. Seed Initial Audit Record
  await prisma.auditEvent.create({
    data: {
      userId: demoUser.id,
      eventType: 'POLICY_CREATED',
      actor: 'USER',
      metadata: JSON.stringify({
        policy_id: defaultPolicy.id,
        policy_name: defaultPolicy.name,
        rules: defaultRules
      })
    }
  });

  console.log('✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
