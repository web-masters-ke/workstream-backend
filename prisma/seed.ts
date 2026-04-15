import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400_000); }
function hoursAgo(n: number) { return new Date(Date.now() - n * 3600_000); }
function daysFrom(n: number) { return new Date(Date.now() + n * 86400_000); }

async function main() {
  console.log('🌱 Seeding WorkStream (fat seed)…');

  const pw = await bcrypt.hash('Password123!', 10);

  // ── Clear ────────────────────────────────────────────────────────────────────
  await prisma.bid.deleteMany();
  await prisma.ticketMessage.deleteMany().catch(() => {});
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
  await prisma.notification.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.user.deleteMany();

  // ── Plans ────────────────────────────────────────────────────────────────────
  const [planFree, planStarter, planGrowth, planEnterprise] = await Promise.all([
    prisma.subscriptionPlan.create({ data: { name: 'Free',       priceCents: 0,      description: '25 tasks/month, up to 2 agents',      features: { tasks: 25,   seats: 2,   sla: false } } }),
    prisma.subscriptionPlan.create({ data: { name: 'Starter',    priceCents: 299900, description: '100 tasks/month, up to 5 agents',     features: { tasks: 100,  seats: 5,   sla: true  } } }),
    prisma.subscriptionPlan.create({ data: { name: 'Growth',     priceCents: 799900, description: 'Unlimited tasks, up to 25 agents',    features: { tasks: -1,   seats: 25,  sla: true, qa: true } } }),
    prisma.subscriptionPlan.create({ data: { name: 'Enterprise', priceCents: 2499900, description: 'Unlimited everything + dedicated CSM', features: { tasks: -1, seats: -1,  sla: true, qa: true, api: true } } }),
  ]);

  // ── System user ──────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.create({ data: {
    email: 'admin@workstream.io', phone: '+254700000001', passwordHash: pw,
    firstName: 'System', lastName: 'Admin', name: 'System Admin',
    role: 'ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
  }});

  // ── Benjamin (owner, linked to all businesses) ────────────────────────────
  const benjamin = await prisma.user.upsert({
    where: { email: 'benjaminkakaimasai@gmail.com' },
    update: { passwordHash: pw },
    create: {
      email: 'benjaminkakaimasai@gmail.com', passwordHash: pw,
      firstName: 'Benjamin', lastName: 'Kakai', name: 'Benjamin Kakai',
      role: 'BUSINESS', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
    },
  });

  // ── 3 Business owners ────────────────────────────────────────────────────────
  const bizOwnerData = [
    { email: 'alice@acmebpo.co.ke',    phone: '+254711000001', firstName: 'Alice',   lastName: 'Munene',  bizName: 'Acme BPO Kenya',        industry: 'Customer Support / BPO',     plan: planGrowth },
    { email: 'david@swiftops.co.ke',   phone: '+254711000002', firstName: 'David',   lastName: 'Njoroge', bizName: 'SwiftOps Ltd',           industry: 'Back-Office Operations',     plan: planStarter },
    { email: 'priya@nexusdata.co.ke',  phone: '+254711000003', firstName: 'Priya',   lastName: 'Patel',   bizName: 'Nexus Data Services',   industry: 'Data Entry & Processing',    plan: planEnterprise },
  ];

  const bizSupervisors = [
    { email: 'brian@acmebpo.co.ke',   phone: '+254711000010', firstName: 'Brian',   lastName: 'Otieno' },
    { email: 'sylvia@swiftops.co.ke', phone: '+254711000011', firstName: 'Sylvia',  lastName: 'Wambua' },
    { email: 'mark@nexusdata.co.ke',  phone: '+254711000012', firstName: 'Mark',    lastName: 'Omondi' },
  ];

  const bizOwnerUsers = await Promise.all(bizOwnerData.map(d => prisma.user.create({ data: {
    email: d.email, phone: d.phone, passwordHash: pw,
    firstName: d.firstName, lastName: d.lastName, name: `${d.firstName} ${d.lastName}`,
    role: 'BUSINESS', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
  }})));

  const supervisorUsers = await Promise.all(bizSupervisors.map(d => prisma.user.create({ data: {
    email: d.email, phone: d.phone, passwordHash: pw,
    firstName: d.firstName, lastName: d.lastName, name: `${d.firstName} ${d.lastName}`,
    role: 'SUPERVISOR', status: 'ACTIVE', emailVerified: true,
  }})));

  // ── Businesses ───────────────────────────────────────────────────────────────
  const businesses = await Promise.all(bizOwnerData.map((d, i) => prisma.business.create({ data: {
    name: d.bizName,
    slug: d.bizName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    industry: d.industry,
    description: `${d.bizName} provides remote workforce solutions across East Africa.`,
    contactEmail: d.email,
    contactPhone: d.phone,
    status: 'ACTIVE',
    planId: d.plan.id,
  }})));

  const [acme, swift, nexus] = businesses;

  // ── Workspaces ───────────────────────────────────────────────────────────────
  const [acmeWs1, acmeWs2, acmeWs3] = await Promise.all([
    prisma.workspace.create({ data: { businessId: acme.id, name: 'Tier-1 Support',    description: 'General customer queries' } }),
    prisma.workspace.create({ data: { businessId: acme.id, name: 'Sales Operations',  description: 'Outbound leads & follow-ups' } }),
    prisma.workspace.create({ data: { businessId: acme.id, name: 'KYC Verification',  description: 'Document verification desk' } }),
  ]);
  const [swiftWs1, swiftWs2] = await Promise.all([
    prisma.workspace.create({ data: { businessId: swift.id, name: 'Back-Office Alpha', description: 'Claims processing' } }),
    prisma.workspace.create({ data: { businessId: swift.id, name: 'Finance Desk',      description: 'Invoice reconciliation' } }),
  ]);
  const [nexusWs1] = await Promise.all([
    prisma.workspace.create({ data: { businessId: nexus.id, name: 'Data Ops',          description: 'ETL & data-entry pipelines' } }),
  ]);

  // ── Business memberships ────────────────────────────────────────────────────
  await prisma.businessMember.createMany({ data: [
    { businessId: acme.id,  userId: bizOwnerUsers[0].id,   workspaceId: acmeWs1.id,  role: 'OWNER',   joinedAt: daysAgo(90) },
    { businessId: acme.id,  userId: supervisorUsers[0].id, workspaceId: acmeWs1.id,  role: 'MANAGER', joinedAt: daysAgo(60) },
    { businessId: acme.id,  userId: benjamin.id,           role: 'OWNER',            joinedAt: daysAgo(100) },
    { businessId: swift.id, userId: bizOwnerUsers[1].id,   workspaceId: swiftWs1.id, role: 'OWNER',   joinedAt: daysAgo(45) },
    { businessId: swift.id, userId: supervisorUsers[1].id, workspaceId: swiftWs1.id, role: 'MANAGER', joinedAt: daysAgo(30) },
    { businessId: nexus.id, userId: bizOwnerUsers[2].id,   workspaceId: nexusWs1.id, role: 'OWNER',   joinedAt: daysAgo(20) },
    { businessId: nexus.id, userId: supervisorUsers[2].id, workspaceId: nexusWs1.id, role: 'MANAGER', joinedAt: daysAgo(15) },
  ]});

  // ── Business wallets ─────────────────────────────────────────────────────────
  await Promise.all(businesses.map((b, i) => prisma.wallet.create({ data: {
    ownerType: 'BUSINESS', ownerId: b.id, businessId: b.id,
    balanceCents: BigInt([120_000_00, 45_000_00, 280_000_00][i]),
    currency: 'KES', status: 'ACTIVE',
  }})));

  // ── 20 Agents ────────────────────────────────────────────────────────────────
  const agentProfiles = [
    { email: 'jane@agent.io',    phone: '+254720000001', first: 'Jane',    last: 'Wanjiru',  city: 'Nairobi',   skills: ['customer-support','chat'],          rating: 4.8, tasks: 143, biz: acme.id  },
    { email: 'peter@agent.io',   phone: '+254720000002', first: 'Peter',   last: 'Kamau',    city: 'Mombasa',   skills: ['sales','telemarketing'],            rating: 4.5, tasks: 87,  biz: acme.id  },
    { email: 'mary@agent.io',    phone: '+254720000003', first: 'Mary',    last: 'Akinyi',   city: 'Kisumu',    skills: ['data-entry','research'],            rating: 4.9, tasks: 201, biz: nexus.id },
    { email: 'daniel@agent.io',  phone: '+254720000004', first: 'Daniel',  last: 'Mwangi',   city: 'Nakuru',    skills: ['social-media','content'],           rating: 4.2, tasks: 55,  biz: null     },
    { email: 'grace@agent.io',   phone: '+254720000005', first: 'Grace',   last: 'Njeri',    city: 'Eldoret',   skills: ['customer-support','sales'],         rating: 4.7, tasks: 118, biz: acme.id  },
    { email: 'samuel@agent.io',  phone: '+254720000006', first: 'Samuel',  last: 'Otieno',   city: 'Nairobi',   skills: ['data-entry','spreadsheets'],        rating: 4.6, tasks: 76,  biz: swift.id },
    { email: 'faith@agent.io',   phone: '+254720000007', first: 'Faith',   last: 'Mutua',    city: 'Thika',     skills: ['chat','email-support'],             rating: 4.4, tasks: 92,  biz: acme.id  },
    { email: 'kevin@agent.io',   phone: '+254720000008', first: 'Kevin',   last: 'Gitau',    city: 'Nairobi',   skills: ['telemarketing','voice'],            rating: 3.9, tasks: 34,  biz: swift.id },
    { email: 'amina@agent.io',   phone: '+254720000009', first: 'Amina',   last: 'Hassan',   city: 'Mombasa',   skills: ['kyc-verification','compliance'],    rating: 4.8, tasks: 167, biz: acme.id  },
    { email: 'tom@agent.io',     phone: '+254720000010', first: 'Tom',     last: 'Kariuki',  city: 'Nairobi',   skills: ['research','report-writing'],        rating: 4.3, tasks: 49,  biz: null     },
    { email: 'lucy@agent.io',    phone: '+254720000011', first: 'Lucy',    last: 'Wambua',   city: 'Kisumu',    skills: ['customer-support','chat'],          rating: 4.6, tasks: 88,  biz: nexus.id },
    { email: 'charles@agent.io', phone: '+254720000012', first: 'Charles', last: 'Ouma',     city: 'Kakamega',  skills: ['data-entry','excel'],               rating: 4.1, tasks: 61,  biz: nexus.id },
    { email: 'diana@agent.io',   phone: '+254720000013', first: 'Diana',   last: 'Muia',     city: 'Machakos',  skills: ['moderation','social-media'],        rating: 4.7, tasks: 130, biz: null     },
    { email: 'joseph@agent.io',  phone: '+254720000014', first: 'Joseph',  last: 'Nderitu',  city: 'Nyeri',     skills: ['sales','crm'],                      rating: 4.5, tasks: 74,  biz: swift.id },
    { email: 'ann@agent.io',     phone: '+254720000015', first: 'Ann',     last: 'Njoroge',  city: 'Nairobi',   skills: ['voice','customer-support'],         rating: 4.9, tasks: 212, biz: acme.id  },
    { email: 'benson@agent.io',  phone: '+254720000016', first: 'Benson',  last: 'Kipchoge', city: 'Eldoret',   skills: ['logistics','tracking'],             rating: 4.0, tasks: 28,  biz: null     },
    { email: 'stella@agent.io',  phone: '+254720000017', first: 'Stella',  last: 'Chebet',   city: 'Kericho',   skills: ['finance','reconciliation'],         rating: 4.7, tasks: 96,  biz: swift.id },
    { email: 'ian@agent.io',     phone: '+254720000018', first: 'Ian',     last: 'Macharia',  city: 'Nairobi',   skills: ['content','copywriting'],           rating: 4.4, tasks: 43,  biz: null     },
    { email: 'rose@agent.io',    phone: '+254720000019', first: 'Rose',    last: 'Adhiambo', city: 'Kisumu',    skills: ['data-entry','research'],            rating: 4.6, tasks: 109, biz: nexus.id },
    { email: 'felix@agent.io',   phone: '+254720000020', first: 'Felix',   last: 'Owino',    city: 'Nairobi',   skills: ['kyc-verification','customer-support'], rating: 4.3, tasks: 58, biz: acme.id },
  ];

  const agentUserRecords = await Promise.all(agentProfiles.map(p => prisma.user.create({ data: {
    email: p.email, phone: p.phone, passwordHash: pw,
    firstName: p.first, lastName: p.last, name: `${p.first} ${p.last}`,
    role: 'AGENT', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
  }})));

  const agents = await Promise.all(agentProfiles.map(async (p, i) => {
    const ag = await prisma.agent.create({ data: {
      userId: agentUserRecords[i].id,
      businessId: p.biz,
      status: 'VERIFIED', kycStatus: 'APPROVED',
      availability: rnd(['ONLINE','ONLINE','OFFLINE','BUSY']),
      bio: `${p.skills[0].replace(/-/g,' ')} specialist with ${rndInt(1,6)}+ years experience. Based in ${p.city}.`,
      headline: `${p.skills[0].replace(/-/g,' ')} expert`,
      rating: new Prisma.Decimal(p.rating),
      totalTasks: p.tasks,
      completedTasks: Math.floor(p.tasks * 0.92),
      country: 'KE', city: p.city,
      hourlyRateCents: rndInt(40, 150) * 100,
      currency: 'KES',
      verifiedAt: daysAgo(rndInt(10, 180)),
      skills: { create: p.skills.map((s, si) => ({ skill: s, proficiencyLevel: si === 0 ? 5 : 4 })) },
    }});
    await prisma.wallet.create({ data: {
      ownerType: 'AGENT', ownerId: ag.id, userId: agentUserRecords[i].id,
      balanceCents: BigInt(rndInt(500, 25000) * 100), currency: 'KES', status: 'ACTIVE',
    }});
    return ag;
  }));

  // ── 60 Tasks (mixed statuses, businesses, workspaces) ────────────────────────
  const taskTemplates = [
    { title: 'Reply to tier-1 support tickets',         category: 'customer-support', skills: ['customer-support'] },
    { title: 'Outbound sales calls — fintech list',     category: 'sales',            skills: ['sales','telemarketing'] },
    { title: 'Data entry: CRM upload from spreadsheet', category: 'data-entry',       skills: ['data-entry'] },
    { title: 'Moderate forum comments',                 category: 'moderation',       skills: ['moderation'] },
    { title: 'Transcribe customer feedback audio',      category: 'research',         skills: ['research'] },
    { title: 'Email categorisation — inbox triage',     category: 'customer-support', skills: ['email-support'] },
    { title: 'KYC document verification batch',         category: 'kyc',              skills: ['kyc-verification'] },
    { title: 'Social media response queue',             category: 'social-media',     skills: ['social-media'] },
    { title: 'Invoice reconciliation run',              category: 'finance',          skills: ['finance'] },
    { title: 'Lead qualification — cold list',          category: 'sales',            skills: ['sales','crm'] },
    { title: 'Product catalogue data entry',            category: 'data-entry',       skills: ['data-entry','excel'] },
    { title: 'Voice call follow-ups (Q2 churn)',        category: 'sales',            skills: ['voice','telemarketing'] },
  ];

  const statuses = ['PENDING','PENDING','ASSIGNED','IN_PROGRESS','IN_PROGRESS','COMPLETED','COMPLETED','COMPLETED','CANCELLED'];
  const allTaskIds: string[] = [];

  for (let i = 0; i < 60; i++) {
    const tmpl = taskTemplates[i % taskTemplates.length];
    const biz  = [acme, acme, swift, nexus][i % 4];
    const ws   = [acmeWs1,acmeWs2,acmeWs3,swiftWs1,swiftWs2,nexusWs1][i % 6];
    const creator = bizOwnerUsers[i % 3];
    const status = statuses[i % statuses.length] as any;
    const isCompleted = status === 'COMPLETED';
    const isActive    = status === 'IN_PROGRESS' || status === 'ASSIGNED';
    const daysOffset  = rndInt(-20, 30);
    const isMarketplace = i % 5 === 0;

    const task = await prisma.task.create({ data: {
      businessId: biz.id,
      workspaceId: ws.businessId === biz.id ? ws.id : undefined,
      createdById: creator.id,
      title: `${tmpl.title} ${i + 1 < 10 ? `0${i+1}` : i+1}`,
      description: 'Full instructions and SOP attached in the task brief. Follow the style guide and escalation matrix.',
      status,
      priority: rnd(['LOW','MEDIUM','HIGH','URGENT']),
      category: tmpl.category,
      requiredSkills: tmpl.skills,
      budgetCents: rndInt(5, 50) * 1000 * 100,
      currency: 'KES',
      slaMinutes: rndInt(30, 240),
      dueAt: daysFrom(daysOffset),
      isMarketplace,
      marketplaceStatus: isMarketplace ? 'APPROVED' : null,
      startedAt: isActive || isCompleted ? hoursAgo(rndInt(2, 48)) : null,
      completedAt: isCompleted ? hoursAgo(rndInt(1, 24)) : null,
    }});
    allTaskIds.push(task.id);

    if (isActive || isCompleted) {
      const agent = agents[i % agents.length];
      await prisma.taskAssignment.create({ data: {
        taskId: task.id, agentId: agent.id,
        status: isCompleted ? 'COMPLETED' : 'ACCEPTED',
        acceptedAt: hoursAgo(rndInt(5, 50)),
        completedAt: isCompleted ? hoursAgo(rndInt(1, 24)) : null,
      }});
      await prisma.taskHistory.create({ data: {
        taskId: task.id, actorId: creator.id, toStatus: status, note: 'Auto-seeded',
      }});
    }

    // Marketplace bids
    if (isMarketplace) {
      const bidCount = rndInt(1, 4);
      for (let b = 0; b < bidCount; b++) {
        const bidAgent = agents[(i + b) % agents.length];
        await prisma.bid.create({ data: {
          taskId: task.id, agentId: bidAgent.id,
          proposedCents: rndInt(4, 48) * 1000 * 100,
          coverNote: `I have relevant experience in ${tmpl.category}. I can deliver this on time.`,
          estimatedDays: rndInt(1, 5),
          status: b === 0 && isCompleted ? 'ACCEPTED' : 'PENDING',
          acceptedAt: b === 0 && isCompleted ? hoursAgo(rndInt(5, 48)) : null,
        }}).catch(() => {});
      }
    }
  }

  // ── 15 Conversations + messages ──────────────────────────────────────────────
  for (let i = 0; i < 15; i++) {
    const biz    = bizOwnerUsers[i % 3];
    const agent  = agentUserRecords[i % agentUserRecords.length];
    const taskId = allTaskIds[i] ?? undefined;
    const convo  = await prisma.conversation.create({ data: {
      type: taskId ? 'TASK' : 'DIRECT',
      taskId,
      title: `Thread ${i + 1}`,
      participants: { create: [{ userId: biz.id }, { userId: agent.id }] },
    }});
    const msgCount = rndInt(3, 8);
    for (let m = 0; m < msgCount; m++) {
      const sender = m % 2 === 0 ? biz.id : agent.id;
      await prisma.message.create({ data: {
        conversationId: convo.id, senderId: sender, type: 'TEXT',
        body: rnd([
          'Please prioritise this batch — client is waiting.',
          'On it — will update you by EOD.',
          'Can you clarify the escalation path for complex cases?',
          'Done! Quality report attached.',
          'Need access to the CRM for this one.',
          'Credentials sent to your email.',
          'All 50 leads called, 12 warm prospects identified.',
          'Great work today! Bonus applied to your wallet.',
        ]),
        createdAt: hoursAgo(msgCount - m),
      }});
    }
  }

  // ── Wallet transactions ───────────────────────────────────────────────────────
  for (let i = 0; i < 40; i++) {
    const agentWallet = await prisma.wallet.findFirst({ where: { userId: agentUserRecords[i % agentUserRecords.length].id } });
    if (!agentWallet) continue;
    const type = rnd(['TASK_PAYMENT','TASK_PAYMENT','TASK_PAYMENT','TOPUP','PAYOUT']) as any;
    const amtCents = BigInt(rndInt(300, 5000) * 100);
    await prisma.walletTransaction.create({ data: {
      walletId: agentWallet.id,
      type, status: 'COMPLETED',
      amountCents: amtCents, currency: 'KES',
      description: type === 'TASK_PAYMENT' ? `Payment for task ${i + 1}` : type === 'TOPUP' ? 'M-Pesa top-up' : 'M-Pesa withdrawal',
      completedAt: daysAgo(rndInt(0, 30)),
      createdAt: daysAgo(rndInt(0, 30)),
    }});
  }

  // ── Invoices ──────────────────────────────────────────────────────────────────
  for (let i = 0; i < 12; i++) {
    const biz = businesses[i % 3];
    const amtCents = BigInt(rndInt(5000, 60000) * 100);
    const tax = amtCents * 16n / 100n;
    await prisma.invoice.create({ data: {
      businessId: biz.id,
      number: `INV-2026-${String(i + 1).padStart(4, '0')}`,
      status: rnd(['DRAFT','ISSUED','PAID','PAID','PAID','OVERDUE']),
      amountCents: amtCents, taxCents: tax, totalCents: amtCents + tax,
      currency: 'KES',
      dueAt: daysFrom(rndInt(-10, 30)),
      issuedAt: daysAgo(rndInt(5, 60)),
      metadata: { description: `Platform subscription — ${rnd(['Jan','Feb','Mar','Apr'])} 2026` } as any,
    }});
  }

  // ── Shifts ────────────────────────────────────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    const agent = agents[i % agents.length];
    const biz   = businesses[i % 3];
    const start = hoursAgo(rndInt(-24, 72));
    const end   = new Date(start.getTime() + 8 * 3600_000);
    await prisma.shift.create({ data: {
      businessId: biz.id, agentId: agent.id,
      startAt: start, endAt: end,
      status: rnd(['SCHEDULED','ACTIVE','COMPLETED','COMPLETED']),
      notes: `Auto-seeded shift ${i + 1}`,
    }});
  }

  // ── QA Reviews ───────────────────────────────────────────────────────────────
  for (let i = 0; i < 15; i++) {
    const taskId = allTaskIds[i * 3 + 2] ?? allTaskIds[i % allTaskIds.length];
    const agent  = agents[i % agents.length];
    const reviewer = supervisorUsers[i % supervisorUsers.length];
    await prisma.qAReview.create({ data: {
      taskId, agentId: agent.id, reviewerId: reviewer.id,
      score: rndInt(3, 5),
      comment: rnd([
        'Excellent quality. Tone was professional throughout.',
        'Good work but a few data formatting issues.',
        'Above SLA. Customer satisfaction score: 9/10.',
        'Minor errors in category tagging — otherwise solid.',
        'Outstanding performance this cycle. Recommend for bonus.',
      ]),
      criteria: { accuracy: rndInt(3,5), tone: rndInt(3,5), speed: rndInt(3,5), compliance: rndInt(3,5) },
    }}).catch(() => {});
  }

  // ── Disputes ──────────────────────────────────────────────────────────────────
  const disputeData = [
    { by: agentUserRecords[0], task: 0, cat: 'PAYMENT',         sub: 'Underpayment on completed task',         desc: 'Received 60% of agreed rate. Task was completed on time and above QA threshold.' },
    { by: agentUserRecords[2], task: 3, cat: 'TASK_QUALITY',   sub: 'Task scope changed after acceptance',    desc: 'Scope increased 3x after I accepted. No extra compensation offered.' },
    { by: bizOwnerUsers[0],   task: 6, cat: 'TASK_QUALITY',   sub: 'Agent submitted incomplete work',        desc: 'Only 40% of tickets were handled correctly. Requesting re-review.' },
    { by: agentUserRecords[5], task: 9, cat: 'AGENT_CONDUCT',  sub: 'Supervisor communication issues',        desc: 'Repeatedly harassed via chat messages outside working hours.' },
    { by: bizOwnerUsers[1],   task: 2, cat: 'PAYMENT',         sub: 'Duplicate invoice charged',              desc: 'Billed twice for March. Reference INV-2026-0003 and INV-2026-0004.' },
  ];

  for (const d of disputeData) {
    await prisma.dispute.create({ data: {
      filedById: d.by.id,
      taskId: allTaskIds[d.task],
      category: d.cat as any,
      status: rnd(['OPEN','IN_PROGRESS','OPEN']),
      subject: d.sub, description: d.desc,
      priority: rnd(['MEDIUM','HIGH','URGENT']),
      assigneeType: 'ADMIN',
    }});
  }

  // ── Notifications ─────────────────────────────────────────────────────────────
  const notifTargets = [...agentUserRecords.slice(0, 10), ...bizOwnerUsers];
  for (let i = 0; i < 30; i++) {
    const user = notifTargets[i % notifTargets.length];
    await prisma.notification.create({ data: {
      userId: user.id, channel: 'IN_APP', status: rnd(['SENT','READ','SENT']),
      title: rnd(['New task available','Task completed','Payment received','Wallet top-up confirmed','QA review ready','Shift starting soon']),
      body: rnd([
        'A new task matching your skills has been posted.',
        'Your task was marked complete. Payment is being processed.',
        'KES 2,500 has been added to your wallet.',
        'Your QA score for last week is ready.',
        'Your shift starts in 30 minutes.',
      ]),
      createdAt: hoursAgo(rndInt(1, 72)),
    }});
  }

  // ── Performance metrics ───────────────────────────────────────────────────────
  for (let i = 0; i < 15; i++) {
    const agent = agents[i % agents.length];
    const pStart = daysAgo(rndInt(30, 90));
    const pEnd   = new Date(pStart.getTime() + 30 * 86400_000);
    await prisma.performanceMetric.create({ data: {
      agentId: agent.id,
      periodStart: pStart,
      periodEnd: pEnd,
      tasksCompleted: rndInt(15, 80),
      tasksFailed: rndInt(0, 5),
      avgRating: new Prisma.Decimal(rndInt(35, 50) / 10),
      avgResponseSec: rndInt(300, 3600),
      slaBreaches: rndInt(0, 3),
      revenueCents: BigInt(rndInt(5000, 40000) * 100),
    }}).catch(() => {});
  }

  // ── Feature flags ─────────────────────────────────────────────────────────────
  await prisma.featureFlag.createMany({ data: [
    { key: 'voice-calls',        enabled: true,  description: 'In-app voice calls between agents and businesses', rolloutPct: 100 },
    { key: 'ai-task-routing',    enabled: false, description: 'AI-powered agent matching for task assignment',    rolloutPct: 0   },
    { key: 'auto-qa-scoring',    enabled: false, description: 'Automated QA scoring via LLMs',                   rolloutPct: 0   },
    { key: 'marketplace-bidding',enabled: true,  description: 'Allow freelance agents to bid on marketplace tasks', rolloutPct: 100 },
    { key: 'wallet-payouts',     enabled: true,  description: 'M-Pesa wallet withdrawals for agents',             rolloutPct: 100 },
    { key: 'shift-scheduler',    enabled: true,  description: 'Shift scheduling module',                          rolloutPct: 100 },
  ]});

  // ── System settings ───────────────────────────────────────────────────────────
  await prisma.systemSetting.createMany({ data: [
    { key: 'pricing.platform_fee_pct',       value: 10 as any,                       category: 'pricing' },
    { key: 'pricing.min_payout_amount',       value: 1000 as any,                     category: 'pricing' },
    { key: 'sla.dispute_hours',               value: 48 as any,                       category: 'sla'     },
    { key: 'sla.support_hours',               value: 24 as any,                       category: 'sla'     },
    { key: 'sla.kyc_hours',                   value: 12 as any,                       category: 'sla'     },
    { key: 'notifications.emailEnabled',      value: true as any,                     category: 'notifications' },
    { key: 'notifications.smsEnabled',        value: true as any,                     category: 'notifications' },
    { key: 'security.sessionTimeoutMinutes',  value: 60 as any,                       category: 'security'},
    { key: 'security.maxLoginAttempts',       value: 5 as any,                        category: 'security'},
    { key: 'payments.mpesaConsumerKey',       value: 'mpesa-ck-placeholder' as any,   category: 'integrations' },
    { key: 'payments.mpesaConsumerSecret',    value: 'mpesa-cs-placeholder' as any,   category: 'integrations' },
    { key: 'payments.brevoApiKey',            value: 'xkeysib-placeholder' as any,    category: 'integrations' },
  ]});

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('');
  console.log('✅ Seed complete!');
  console.log('');
  console.log('📦 Data:');
  console.log(`  ${bizOwnerUsers.length + 1} businesses (Acme BPO, SwiftOps, Nexus Data + Benjamin)`);
  console.log(`  ${agentProfiles.length} agents across all businesses`);
  console.log(`  60 tasks (mixed: pending / assigned / in-progress / completed / cancelled)`);
  console.log(`  12 marketplace listings with bids`);
  console.log(`  15 conversations with messages`);
  console.log(`  40 wallet transactions`);
  console.log(`  12 invoices`);
  console.log(`  20 shifts`);
  console.log(`  15 QA reviews`);
  console.log(`   5 disputes`);
  console.log(`  30 notifications`);
  console.log('');
  console.log('🔐 All passwords: Password123!');
  console.log('');
  console.log('  admin@workstream.io          ADMIN');
  console.log('  alice@acmebpo.co.ke          BUSINESS (Acme BPO)');
  console.log('  david@swiftops.co.ke         BUSINESS (SwiftOps)');
  console.log('  priya@nexusdata.co.ke        BUSINESS (Nexus Data)');
  console.log('  brian@acmebpo.co.ke          SUPERVISOR');
  console.log('  jane@agent.io                AGENT');
  console.log('  mary@agent.io                AGENT');
  console.log('  ann@agent.io                 AGENT (top rated: 4.9)');
  console.log('  benjaminkakaimasai@gmail.com BUSINESS (owner of Acme)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
