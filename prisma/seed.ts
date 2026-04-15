import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding WorkStream...');

  const pw = await bcrypt.hash('Password123!', 10);

  await prisma.featureFlag.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.qAReview.deleteMany();
  await prisma.performanceMetric.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.callSession.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.taskHistory.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.agentAvailabilitySlot.deleteMany();
  await prisma.agentSkill.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.businessMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.business.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.user.deleteMany();

  const [free, pro, enterprise] = await Promise.all([
    prisma.subscriptionPlan.create({
      data: { name: 'Free', priceCents: 0, description: '25 tasks / month', features: { tasksPerMonth: 25, seats: 2 } },
    }),
    prisma.subscriptionPlan.create({
      data: { name: 'Pro', priceCents: 9900, description: '1000 tasks / month', features: { tasksPerMonth: 1000, seats: 10 } },
    }),
    prisma.subscriptionPlan.create({
      data: { name: 'Enterprise', priceCents: 49900, description: 'Unlimited', features: { tasksPerMonth: -1, seats: -1 } },
    }),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@workstream.io',
      phone: '+254700000001',
      passwordHash: pw,
      firstName: 'System',
      lastName: 'Admin',
      name: 'System Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'benjaminkakaimasai@gmail.com' },
    update: {},
    create: {
      email: 'benjaminkakaimasai@gmail.com',
      passwordHash: pw,
      firstName: 'Benjamin',
      lastName: 'Kakai',
      name: 'Benjamin Kakai',
      role: 'BUSINESS',
      status: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
    },
  });

  const bizOwner = await prisma.user.create({
    data: {
      email: 'owner@acme.com',
      phone: '+254700000002',
      passwordHash: pw,
      firstName: 'Alice',
      lastName: 'Munene',
      name: 'Alice Munene',
      role: 'BUSINESS',
      status: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      email: 'supervisor@acme.com',
      phone: '+254700000003',
      passwordHash: pw,
      firstName: 'Brian',
      lastName: 'Otieno',
      name: 'Brian Otieno',
      role: 'SUPERVISOR',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const agentUsers = await Promise.all(
    [
      { email: 'jane@agent.io', phone: '+254700000010', firstName: 'Jane', lastName: 'Wanjiru', city: 'Nairobi', skills: ['customer-support', 'chat'], rating: 4.8 },
      { email: 'peter@agent.io', phone: '+254700000011', firstName: 'Peter', lastName: 'Kamau', city: 'Mombasa', skills: ['sales', 'telemarketing'], rating: 4.5 },
      { email: 'mary@agent.io', phone: '+254700000012', firstName: 'Mary', lastName: 'Akinyi', city: 'Kisumu', skills: ['data-entry', 'research'], rating: 4.9 },
      { email: 'daniel@agent.io', phone: '+254700000013', firstName: 'Daniel', lastName: 'Mwangi', city: 'Nakuru', skills: ['social-media', 'content'], rating: 4.2 },
      { email: 'grace@agent.io', phone: '+254700000014', firstName: 'Grace', lastName: 'Njeri', city: 'Eldoret', skills: ['customer-support', 'sales'], rating: 4.7 },
    ].map(async (a) => {
      const u = await prisma.user.create({
        data: {
          email: a.email,
          phone: a.phone,
          passwordHash: pw,
          firstName: a.firstName,
          lastName: a.lastName,
          name: `${a.firstName} ${a.lastName}`,
          role: 'AGENT',
          status: 'ACTIVE',
          emailVerified: true,
          phoneVerified: true,
        },
      });
      return { user: u, profile: a };
    }),
  );

  const acme = await prisma.business.create({
    data: {
      name: 'Acme Support Co.',
      slug: 'acme-support',
      industry: 'Customer Service',
      description: 'Outsourced customer support for SaaS companies',
      contactEmail: 'billing@acme.com',
      contactPhone: '+254700000002',
      status: 'ACTIVE',
      planId: pro.id,
    },
  });

  const acmeWs1 = await prisma.workspace.create({
    data: { businessId: acme.id, name: 'Tier 1 Support', description: 'General inquiries' },
  });
  const acmeWs2 = await prisma.workspace.create({
    data: { businessId: acme.id, name: 'Sales Ops', description: 'Lead qualification & follow-ups' },
  });

  const benjamin = await prisma.user.findUnique({ where: { email: 'benjaminkakaimasai@gmail.com' } });
  await prisma.businessMember.createMany({
    data: [
      { businessId: acme.id, userId: bizOwner.id, workspaceId: acmeWs1.id, role: 'OWNER', joinedAt: new Date() },
      { businessId: acme.id, userId: supervisor.id, workspaceId: acmeWs1.id, role: 'MANAGER', joinedAt: new Date() },
      ...(benjamin ? [{ businessId: acme.id, userId: benjamin.id, role: 'OWNER' as const, joinedAt: new Date() }] : []),
    ],
  });

  await prisma.wallet.create({
    data: { ownerType: 'BUSINESS', ownerId: acme.id, businessId: acme.id, balanceCents: BigInt(50000_00), currency: 'KES' },
  });

  const agents = await Promise.all(
    agentUsers.map(async ({ user, profile }, i) => {
      const agent = await prisma.agent.create({
        data: {
          userId: user.id,
          businessId: i < 3 ? acme.id : null,
          status: 'VERIFIED',
          kycStatus: 'APPROVED',
          availability: i % 2 === 0 ? 'ONLINE' : 'OFFLINE',
          bio: `Experienced ${profile.skills[0]} agent based in ${profile.city}`,
          headline: `${profile.skills[0].replace('-', ' ')} specialist`,
          rating: new Prisma.Decimal(profile.rating),
          totalTasks: 20 + i * 5,
          completedTasks: 18 + i * 5,
          country: 'KE',
          city: profile.city,
          hourlyRateCents: 500 + i * 100,
          currency: 'KES',
          verifiedAt: new Date(),
          skills: {
            create: profile.skills.map((s) => ({ skill: s, proficiencyLevel: 4 })),
          },
        },
      });
      await prisma.wallet.create({
        data: {
          ownerType: 'AGENT',
          ownerId: agent.id,
          userId: user.id,
          balanceCents: BigInt((1000 + i * 500) * 100),
          currency: 'KES',
        },
      });
      return agent;
    }),
  );

  const taskTitles = [
    'Reply to tier-1 support tickets (batch 1)',
    'Follow up with 50 sales leads from Q1',
    'Transcribe customer feedback audio',
    'Moderate forum comments — hour block',
    'Outbound sales calls — fintech list',
    'Data entry: spreadsheet → CRM',
    'Social media responses (Instagram)',
    'Email categorization',
  ];

  const tasks: { id: string; status: string }[] = [];
  for (let i = 0; i < taskTitles.length; i++) {
    const status = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED', 'PENDING', 'IN_PROGRESS', 'PENDING'][i];
    const t = await prisma.task.create({
      data: {
        businessId: acme.id,
        workspaceId: i % 2 === 0 ? acmeWs1.id : acmeWs2.id,
        createdById: bizOwner.id,
        title: taskTitles[i],
        description: 'Detailed instructions would go here. Follow the SOP document attached to the job.',
        status: status as any,
        priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const)[i % 4],
        category: i % 2 === 0 ? 'customer-support' : 'sales',
        requiredSkills: i % 2 === 0 ? ['customer-support'] : ['sales'],
        budgetCents: 500 * 100 + i * 100 * 100,
        currency: 'KES',
        slaMinutes: 60 + i * 15,
        dueAt: new Date(Date.now() + (i + 1) * 3600_000),
        startedAt: status === 'IN_PROGRESS' || status === 'COMPLETED' ? new Date(Date.now() - 1800_000) : null,
        completedAt: status === 'COMPLETED' ? new Date(Date.now() - 600_000) : null,
      },
    });
    tasks.push({ id: t.id, status });

    if (status === 'ASSIGNED' || status === 'IN_PROGRESS' || status === 'COMPLETED') {
      const agent = agents[i % agents.length];
      await prisma.taskAssignment.create({
        data: {
          taskId: t.id,
          agentId: agent.id,
          status: status === 'COMPLETED' ? 'COMPLETED' : 'ACCEPTED',
          acceptedAt: new Date(Date.now() - 2400_000),
          completedAt: status === 'COMPLETED' ? new Date(Date.now() - 600_000) : null,
        },
      });
      await prisma.taskHistory.create({
        data: { taskId: t.id, actorId: bizOwner.id, toStatus: status as any, note: 'Auto-seeded' },
      });
    }
  }

  const convo = await prisma.conversation.create({
    data: {
      type: 'TASK',
      taskId: tasks[1].id,
      title: 'Sales follow-up coordination',
      participants: {
        create: [
          { userId: bizOwner.id },
          { userId: agentUsers[0].user.id },
        ],
      },
    },
  });

  await prisma.message.createMany({
    data: [
      { conversationId: convo.id, senderId: bizOwner.id, type: 'TEXT', body: 'Hey Jane, please prioritize the top-50 list today.' },
      { conversationId: convo.id, senderId: agentUsers[0].user.id, type: 'TEXT', body: 'On it — will have first 20 done by noon.' },
      { conversationId: convo.id, senderId: bizOwner.id, type: 'TEXT', body: 'Perfect 🙏' },
    ],
  });

  for (let i = 0; i < 3; i++) {
    await prisma.walletTransaction.create({
      data: {
        walletId: (await prisma.wallet.findFirst({ where: { userId: agentUsers[i].user.id } }))!.id,
        type: 'TASK_PAYMENT',
        status: 'COMPLETED',
        amountCents: BigInt(500 * 100),
        currency: 'KES',
        description: `Payment for task: ${taskTitles[i]}`,
      },
    });
  }

  await prisma.qAReview.create({
    data: {
      taskId: tasks[3].id,
      agentId: agents[0].id,
      reviewerId: supervisor.id,
      score: 5,
      comment: 'Excellent handling of the escalation. Tone was empathetic.',
      criteria: { accuracy: 5, tone: 5, speed: 4 },
    },
  });

  await prisma.dispute.create({
    data: {
      filedById: agentUsers[1].user.id,
      taskId: tasks[0].id,
      category: 'PAYMENT',
      status: 'OPEN',
      subject: 'Underpayment on batch work',
      description: 'Only received 60% of agreed rate for completed work.',
    },
  });

  await prisma.notification.createMany({
    data: [
      { userId: agentUsers[0].user.id, channel: 'IN_APP', title: 'New task offered', body: 'A new customer-support task is ready for you.', status: 'SENT' },
      { userId: bizOwner.id, channel: 'IN_APP', title: 'Task completed', body: 'Jane completed "Reply to tier-1 support tickets"', status: 'SENT' },
    ],
  });

  await prisma.featureFlag.createMany({
    data: [
      { key: 'voice-calls', enabled: true, description: 'Enable in-app voice calls between agents and businesses' },
      { key: 'ai-task-routing', enabled: false, description: 'AI-powered agent matching' },
      { key: 'auto-qa-scoring', enabled: false, description: 'Automated QA scoring using LLMs' },
    ],
  });

  await prisma.systemSetting.createMany({
    data: [
      { key: 'platform.commissionPct', value: 10 as any, category: 'billing' },
      { key: 'payout.minCents', value: 100000 as any, category: 'billing' },
      { key: 'payout.providers', value: ['mpesa', 'airtel', 'bank'] as any, category: 'payout' },
    ],
  });

  console.log('✓ Seeded:');
  console.log('  - 3 plans (Free, Pro, Enterprise)');
  console.log('  - 1 admin, 1 biz owner, 1 supervisor, 5 agents');
  console.log('  - 1 business (Acme) + 2 workspaces');
  console.log(`  - ${tasks.length} tasks (mixed statuses)`);
  console.log('  - Wallets, transactions, QA review, dispute, notifications');
  console.log('');
  console.log('🔐 Login credentials (password: Password123!):');
  console.log('  admin@workstream.io       (ADMIN)');
  console.log('  owner@acme.com            (BUSINESS)');
  console.log('  supervisor@acme.com       (SUPERVISOR)');
  console.log('  jane@agent.io             (AGENT)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
