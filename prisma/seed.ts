import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400_000); }
function hoursAgo(n: number) { return new Date(Date.now() - n * 3600_000); }
function daysFrom(n: number) { return new Date(Date.now() + n * 86400_000); }
function uid() { return Math.random().toString(36).slice(2, 10).toUpperCase(); }

async function main() {
  console.log('🌱 Seeding WorkStream (ultra-fat seed)…');
  const pw = await bcrypt.hash('Password123!', 10);

  // ── Clear ALL tables (FK order) ───────────────────────────────────────────────
  await prisma.ticketMessage.deleteMany().catch(() => {});
  await prisma.dispute.deleteMany();
  await prisma.taskSubmission.deleteMany();
  await prisma.qAReview.deleteMany();
  await prisma.performanceMetric.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.taskHistory.deleteMany();
  await prisma.task.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.callSession.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.agentAvailabilitySlot.deleteMany();
  await prisma.agentSkill.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.businessMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.business.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.user.deleteMany();

  // ── Plans ─────────────────────────────────────────────────────────────────────
  const [planFree, planStarter, planGrowth, planEnterprise] = await Promise.all([
    prisma.subscriptionPlan.create({ data: { name: 'Free',       priceCents: 0,       currency: 'KES', description: '25 tasks/month, 2 agents, community support',           features: { tasks: 25,  seats: 2,  sla: false, qa: false, api: false } } }),
    prisma.subscriptionPlan.create({ data: { name: 'Starter',    priceCents: 299900,  currency: 'KES', description: '200 tasks/month, 10 agents, email support + SLA',       features: { tasks: 200, seats: 10, sla: true,  qa: false, api: false } } }),
    prisma.subscriptionPlan.create({ data: { name: 'Growth',     priceCents: 799900,  currency: 'KES', description: 'Unlimited tasks, 25 agents, SLA + QA module',           features: { tasks: -1,  seats: 25, sla: true,  qa: true,  api: false } } }),
    prisma.subscriptionPlan.create({ data: { name: 'Enterprise', priceCents: 2499900, currency: 'KES', description: 'Unlimited everything, dedicated CSM, custom SLAs + API', features: { tasks: -1,  seats: -1, sla: true,  qa: true,  api: true, csm: true } } }),
  ]);

  // ── Admin + Benjamin ──────────────────────────────────────────────────────────
  const adminUser = await prisma.user.create({ data: {
    email: 'admin@workstream.io', phone: '+254700000001', passwordHash: pw,
    firstName: 'System', lastName: 'Admin', name: 'System Admin',
    role: 'ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true, lastLoginAt: hoursAgo(2),
  }});

  const benjamin = await prisma.user.upsert({
    where: { email: 'benjaminkakaimasai@gmail.com' },
    update: { passwordHash: pw },
    create: {
      email: 'benjaminkakaimasai@gmail.com', phone: '+254700000099', passwordHash: pw,
      firstName: 'Benjamin', lastName: 'Kakai', name: 'Benjamin Kakai',
      role: 'BUSINESS', status: 'ACTIVE', emailVerified: true, phoneVerified: true, lastLoginAt: hoursAgo(1),
    },
  });

  // ── 4 Business owners + 4 supervisors ────────────────────────────────────────
  const ownerDefs = [
    { email: 'alice@acmebpo.co.ke',     phone: '+254711000001', first: 'Alice',   last: 'Munene'  },
    { email: 'david@swiftops.co.ke',    phone: '+254711000002', first: 'David',   last: 'Njoroge' },
    { email: 'priya@nexusdata.co.ke',   phone: '+254711000003', first: 'Priya',   last: 'Patel'   },
    { email: 'kofi@peaksales.africa',   phone: '+254711000004', first: 'Kofi',    last: 'Asante'  },
  ];
  const supDefs = [
    { email: 'brian@acmebpo.co.ke',     phone: '+254711000010', first: 'Brian',   last: 'Otieno'  },
    { email: 'sylvia@swiftops.co.ke',   phone: '+254711000011', first: 'Sylvia',  last: 'Wambua'  },
    { email: 'mark@nexusdata.co.ke',    phone: '+254711000012', first: 'Mark',    last: 'Omondi'  },
    { email: 'naomi@peaksales.africa',  phone: '+254711000013', first: 'Naomi',   last: 'Kibet'   },
  ];

  const bizOwnerUsers = await Promise.all(ownerDefs.map(d => prisma.user.create({ data: {
    email: d.email, phone: d.phone, passwordHash: pw,
    firstName: d.first, lastName: d.last, name: `${d.first} ${d.last}`,
    role: 'BUSINESS', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
    lastLoginAt: daysAgo(rndInt(0, 3)),
  }})));

  const supervisorUsers = await Promise.all(supDefs.map(d => prisma.user.create({ data: {
    email: d.email, phone: d.phone, passwordHash: pw,
    firstName: d.first, lastName: d.last, name: `${d.first} ${d.last}`,
    role: 'SUPERVISOR', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
    lastLoginAt: daysAgo(rndInt(0, 2)),
  }})));

  // ── 4 Businesses ─────────────────────────────────────────────────────────────
  const bizDefs = [
    { name: 'Acme BPO Kenya',       slug: 'acme-bpo-kenya',       industry: 'Customer Support / BPO',     plan: planGrowth,      wallet: 12_500_000n, desc: 'East Africa\'s fastest-growing BPO firm, serving fintech, FMCG and telecom clients across 12 countries.' },
    { name: 'SwiftOps Ltd',         slug: 'swiftops-ltd',         industry: 'Back-Office Operations',     plan: planStarter,     wallet: 4_500_000n,  desc: 'Specialised in insurance claims processing, finance reconciliation and back-office ops for banking clients.' },
    { name: 'Nexus Data Services',  slug: 'nexus-data-services',  industry: 'Data Entry & Processing',    plan: planEnterprise,  wallet: 28_000_000n, desc: 'High-accuracy data entry, ETL pipelines and annotation services for ML/AI companies and research institutions.' },
    { name: 'PeakSales Africa',     slug: 'peaksales-africa',     industry: 'Sales & Telemarketing',      plan: planFree,        wallet: 750_000n,    desc: 'Outbound sales campaigns, lead qualification and CRM management for B2B SaaS and real-estate companies.' },
  ];

  const businesses = await Promise.all(bizDefs.map((d, i) => prisma.business.create({ data: {
    name: d.name, slug: d.slug, industry: d.industry, description: d.desc,
    website: `https://${d.slug}.co.ke`, contactEmail: ownerDefs[i].email,
    contactPhone: ownerDefs[i].phone, status: 'ACTIVE', planId: d.plan.id,
  }})));
  const [acme, swift, nexus, peak] = businesses;

  await Promise.all(businesses.map((b, i) => prisma.wallet.create({ data: {
    ownerType: 'BUSINESS', ownerId: b.id, businessId: b.id,
    balanceCents: bizDefs[i].wallet, currency: 'KES', status: 'ACTIVE',
  }})));

  // ── Workspaces ────────────────────────────────────────────────────────────────
  const acmeWs = await Promise.all([
    prisma.workspace.create({ data: { businessId: acme.id, name: 'Tier-1 Support',   description: 'General customer queries — phone, email, chat', timezone: 'Africa/Nairobi', currency: 'KES' } }),
    prisma.workspace.create({ data: { businessId: acme.id, name: 'Tier-2 Escalations', description: 'Complex escalations and complaint resolution', timezone: 'Africa/Nairobi', currency: 'KES' } }),
    prisma.workspace.create({ data: { businessId: acme.id, name: 'Sales Ops',        description: 'Outbound sales calls and lead follow-up',       timezone: 'Africa/Nairobi', currency: 'KES' } }),
    prisma.workspace.create({ data: { businessId: acme.id, name: 'KYC Desk',         description: 'Document review and identity verification',      timezone: 'Africa/Nairobi', currency: 'KES' } }),
  ]);
  const swiftWs = await Promise.all([
    prisma.workspace.create({ data: { businessId: swift.id, name: 'Claims Processing', description: 'Insurance and banking claims',         timezone: 'Africa/Nairobi', currency: 'KES' } }),
    prisma.workspace.create({ data: { businessId: swift.id, name: 'Finance Desk',      description: 'Invoice and payment reconciliation',   timezone: 'Africa/Nairobi', currency: 'KES' } }),
    prisma.workspace.create({ data: { businessId: swift.id, name: 'Back-Office Alpha', description: 'Data entry and processing queue',      timezone: 'Africa/Nairobi', currency: 'KES' } }),
  ]);
  const nexusWs = await Promise.all([
    prisma.workspace.create({ data: { businessId: nexus.id, name: 'Data Ops',       description: 'ETL pipelines and structured data entry',              timezone: 'Africa/Nairobi', currency: 'KES' } }),
    prisma.workspace.create({ data: { businessId: nexus.id, name: 'ML Annotation',  description: 'Image, text and audio annotation for AI training',     timezone: 'Africa/Nairobi', currency: 'KES' } }),
    prisma.workspace.create({ data: { businessId: nexus.id, name: 'Research Desk',  description: 'Web research and data collection',                     timezone: 'Africa/Nairobi', currency: 'KES' } }),
    prisma.workspace.create({ data: { businessId: nexus.id, name: 'QA & Validation', description: 'Quality assurance on delivered datasets',             timezone: 'Africa/Nairobi', currency: 'KES' } }),
  ]);
  const peakWs = await Promise.all([
    prisma.workspace.create({ data: { businessId: peak.id, name: 'Outbound Sales', description: 'Cold calling and prospect qualification', timezone: 'Africa/Nairobi', currency: 'KES' } }),
    prisma.workspace.create({ data: { businessId: peak.id, name: 'CRM Management', description: 'HubSpot and Salesforce data management',  timezone: 'Africa/Nairobi', currency: 'KES' } }),
  ]);

  // ── Business memberships ──────────────────────────────────────────────────────
  await prisma.businessMember.createMany({ data: [
    { businessId: acme.id,  userId: bizOwnerUsers[0].id,  workspaceId: acmeWs[0].id,  role: 'OWNER',      joinedAt: daysAgo(120) },
    { businessId: acme.id,  userId: supervisorUsers[0].id, workspaceId: acmeWs[0].id, role: 'SUPERVISOR', joinedAt: daysAgo(90) },
    { businessId: acme.id,  userId: benjamin.id,                                       role: 'OWNER',      joinedAt: daysAgo(150) },
    { businessId: swift.id, userId: bizOwnerUsers[1].id,  workspaceId: swiftWs[0].id, role: 'OWNER',      joinedAt: daysAgo(60) },
    { businessId: swift.id, userId: supervisorUsers[1].id, workspaceId: swiftWs[0].id,role: 'SUPERVISOR', joinedAt: daysAgo(45) },
    { businessId: nexus.id, userId: bizOwnerUsers[2].id,  workspaceId: nexusWs[0].id, role: 'OWNER',      joinedAt: daysAgo(80) },
    { businessId: nexus.id, userId: supervisorUsers[2].id, workspaceId: nexusWs[0].id,role: 'SUPERVISOR', joinedAt: daysAgo(60) },
    { businessId: peak.id,  userId: bizOwnerUsers[3].id,  workspaceId: peakWs[0].id,  role: 'OWNER',      joinedAt: daysAgo(30) },
    { businessId: peak.id,  userId: supervisorUsers[3].id, workspaceId: peakWs[0].id, role: 'SUPERVISOR', joinedAt: daysAgo(20) },
  ]});

  // ── 26 Agents ─────────────────────────────────────────────────────────────────
  // kyc: APPROVED | PENDING | NOT_SUBMITTED | REJECTED
  const agentDefs = [
    // ACME (8)
    { email: 'jane@agent.io',    phone: '+254720000001', first: 'Jane',    last: 'Wanjiru',  city: 'Nairobi',  skills: ['customer-support','chat','email-support'],        rating: 4.8, tasks: 143, biz: () => acme.id, kyc: 'APPROVED',      agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 8000  },
    { email: 'peter@agent.io',   phone: '+254720000002', first: 'Peter',   last: 'Kamau',    city: 'Mombasa',  skills: ['sales','telemarketing','crm'],                    rating: 4.5, tasks: 87,  biz: () => acme.id, kyc: 'APPROVED',      agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 7000  },
    { email: 'grace@agent.io',   phone: '+254720000005', first: 'Grace',   last: 'Njeri',    city: 'Eldoret',  skills: ['customer-support','voice','sales'],               rating: 4.7, tasks: 118, biz: () => acme.id, kyc: 'APPROVED',      agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 7500  },
    { email: 'faith@agent.io',   phone: '+254720000007', first: 'Faith',   last: 'Mutua',    city: 'Thika',    skills: ['chat','email-support','social-media'],            rating: 4.4, tasks: 92,  biz: () => acme.id, kyc: 'APPROVED',      agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 6500  },
    { email: 'amina@agent.io',   phone: '+254720000009', first: 'Amina',   last: 'Hassan',   city: 'Mombasa',  skills: ['kyc-verification','compliance','research'],       rating: 4.8, tasks: 167, biz: () => acme.id, kyc: 'APPROVED',      agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 9000  },
    { email: 'ann@agent.io',     phone: '+254720000015', first: 'Ann',     last: 'Njoroge',  city: 'Nairobi',  skills: ['voice','customer-support','chat'],                rating: 4.9, tasks: 212, biz: () => acme.id, kyc: 'APPROVED',      agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 9500  },
    { email: 'felix@agent.io',   phone: '+254720000020', first: 'Felix',   last: 'Owino',    city: 'Nairobi',  skills: ['kyc-verification','customer-support'],            rating: 0.0, tasks: 0,   biz: () => acme.id, kyc: 'PENDING',       agStatus: 'PENDING_VERIFICATION',  type: 'EMPLOYEE',   rate: 6000  },
    { email: 'cynthia@agent.io', phone: '+254720000021', first: 'Cynthia', last: 'Auma',     city: 'Kisumu',   skills: ['customer-support','email-support'],               rating: 0.0, tasks: 0,   biz: () => acme.id, kyc: 'NOT_SUBMITTED', agStatus: 'PENDING_VERIFICATION',  type: 'EMPLOYEE',   rate: 5500  },
    // SWIFT (6)
    { email: 'samuel@agent.io',  phone: '+254720000006', first: 'Samuel',  last: 'Otieno',   city: 'Nairobi',  skills: ['data-entry','spreadsheets','finance'],            rating: 4.6, tasks: 76,  biz: () => swift.id, kyc: 'APPROVED',     agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 8500  },
    { email: 'kevin@agent.io',   phone: '+254720000008', first: 'Kevin',   last: 'Gitau',    city: 'Nairobi',  skills: ['telemarketing','voice','sales'],                  rating: 3.9, tasks: 34,  biz: () => swift.id, kyc: 'APPROVED',     agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 6000  },
    { email: 'stella@agent.io',  phone: '+254720000017', first: 'Stella',  last: 'Chebet',   city: 'Kericho',  skills: ['finance','reconciliation','spreadsheets'],        rating: 4.7, tasks: 96,  biz: () => swift.id, kyc: 'APPROVED',     agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 9000  },
    { email: 'joseph@agent.io',  phone: '+254720000014', first: 'Joseph',  last: 'Nderitu',  city: 'Nyeri',    skills: ['sales','crm','research'],                        rating: 4.5, tasks: 74,  biz: () => swift.id, kyc: 'APPROVED',     agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 7500  },
    { email: 'emma@agent.io',    phone: '+254720000022', first: 'Emma',    last: 'Wekesa',   city: 'Kakamega', skills: ['data-entry','finance'],                          rating: 0.0, tasks: 0,   biz: () => swift.id, kyc: 'REJECTED',     agStatus: 'SUSPENDED',             type: 'EMPLOYEE',   rate: 5500  },
    { email: 'dennis@agent.io',  phone: '+254720000023', first: 'Dennis',  last: 'Baraza',   city: 'Mombasa',  skills: ['customer-support','voice'],                      rating: 4.2, tasks: 41,  biz: () => swift.id, kyc: 'APPROVED',     agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 6500  },
    // NEXUS (7)
    { email: 'mary@agent.io',    phone: '+254720000003', first: 'Mary',    last: 'Akinyi',   city: 'Kisumu',   skills: ['data-entry','research','spreadsheets'],           rating: 4.9, tasks: 201, biz: () => nexus.id, kyc: 'APPROVED',    agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 8000  },
    { email: 'lucy@agent.io',    phone: '+254720000011', first: 'Lucy',    last: 'Wambua',   city: 'Kisumu',   skills: ['customer-support','chat','research'],             rating: 4.6, tasks: 88,  biz: () => nexus.id, kyc: 'APPROVED',    agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 7000  },
    { email: 'charles@agent.io', phone: '+254720000012', first: 'Charles', last: 'Ouma',     city: 'Kakamega', skills: ['data-entry','excel','research'],                  rating: 4.1, tasks: 61,  biz: () => nexus.id, kyc: 'APPROVED',    agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 6500  },
    { email: 'rose@agent.io',    phone: '+254720000019', first: 'Rose',    last: 'Adhiambo', city: 'Kisumu',   skills: ['data-entry','research','moderation'],             rating: 4.6, tasks: 109, biz: () => nexus.id, kyc: 'APPROVED',    agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 7500  },
    { email: 'ian@agent.io',     phone: '+254720000018', first: 'Ian',     last: 'Macharia', city: 'Nairobi',  skills: ['content','copywriting','research'],               rating: 4.4, tasks: 43,  biz: () => nexus.id, kyc: 'APPROVED',    agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 8000  },
    { email: 'violet@agent.io',  phone: '+254720000024', first: 'Violet',  last: 'Maina',    city: 'Nakuru',   skills: ['data-entry','excel'],                            rating: 0.0, tasks: 0,   biz: () => nexus.id, kyc: 'PENDING',     agStatus: 'PENDING_VERIFICATION',  type: 'EMPLOYEE',   rate: 5500  },
    { email: 'gerald@agent.io',  phone: '+254720000025', first: 'Gerald',  last: 'Kogo',     city: 'Nairobi',  skills: ['moderation','content','social-media'],            rating: 4.3, tasks: 52,  biz: () => nexus.id, kyc: 'APPROVED',    agStatus: 'VERIFIED',              type: 'EMPLOYEE',   rate: 7000  },
    // PEAK / freelancers (5)
    { email: 'daniel@agent.io',  phone: '+254720000004', first: 'Daniel',  last: 'Mwangi',   city: 'Nakuru',   skills: ['sales','telemarketing','social-media'],           rating: 4.2, tasks: 55,  biz: () => peak.id,  kyc: 'APPROVED',    agStatus: 'VERIFIED',              type: 'FREELANCER', rate: 10000 },
    { email: 'diana@agent.io',   phone: '+254720000013', first: 'Diana',   last: 'Muia',     city: 'Machakos', skills: ['social-media','content','copywriting'],           rating: 4.7, tasks: 130, biz: () => null,     kyc: 'APPROVED',    agStatus: 'VERIFIED',              type: 'FREELANCER', rate: 12000 },
    { email: 'benson@agent.io',  phone: '+254720000016', first: 'Benson',  last: 'Kipchoge', city: 'Eldoret',  skills: ['sales','crm','telemarketing'],                   rating: 4.0, tasks: 28,  biz: () => peak.id,  kyc: 'APPROVED',    agStatus: 'VERIFIED',              type: 'FREELANCER', rate: 9000  },
    { email: 'tom@agent.io',     phone: '+254720000010', first: 'Tom',     last: 'Kariuki',  city: 'Nairobi',  skills: ['research','report-writing','content'],            rating: 4.3, tasks: 49,  biz: () => null,     kyc: 'NOT_SUBMITTED', agStatus: 'PENDING_VERIFICATION', type: 'FREELANCER', rate: 8000  },
    { email: 'winnie@agent.io',  phone: '+254720000026', first: 'Winnie',  last: 'Ochieng',  city: 'Kisumu',   skills: ['sales','voice','customer-support'],               rating: 0.0, tasks: 0,   biz: () => peak.id,  kyc: 'REJECTED',    agStatus: 'SUSPENDED',             type: 'FREELANCER', rate: 7500  },
  ];

  const agentUserRecords = await Promise.all(agentDefs.map(p => prisma.user.create({ data: {
    email: p.email, phone: p.phone, passwordHash: pw,
    firstName: p.first, lastName: p.last, name: `${p.first} ${p.last}`,
    role: 'AGENT', status: p.agStatus === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
    emailVerified: true, phoneVerified: p.kyc === 'APPROVED',
    lastLoginAt: p.tasks > 0 ? daysAgo(rndInt(0, 7)) : undefined,
  }})));

  const agents = await Promise.all(agentDefs.map(async (p, i) => {
    const isApproved = p.kyc === 'APPROVED';
    const ag = await prisma.agent.create({ data: {
      userId: agentUserRecords[i].id,
      businessId: p.biz(),
      status: p.agStatus as any,
      kycStatus: p.kyc as any,
      agentType: p.type as any,
      availability: isApproved && p.tasks > 0 ? rnd(['ONLINE','ONLINE','OFFLINE','BUSY','ON_SHIFT']) : 'OFFLINE',
      bio: `${p.skills[0].replace(/-/g,' ')} specialist with ${rndInt(1, 8)}+ years of experience. Based in ${p.city}, Kenya.`,
      headline: `${p.skills[0].replace(/-/g,' ')} expert | ${p.city}`,
      rating: new Prisma.Decimal(p.rating),
      totalTasks: p.tasks,
      completedTasks: Math.floor(p.tasks * 0.92),
      country: 'KE', city: p.city,
      hourlyRateCents: p.rate,
      currency: 'KES',
      verifiedAt: isApproved ? daysAgo(rndInt(10, 200)) : undefined,
      skills: { create: p.skills.map((s, si) => ({ skill: s, proficiencyLevel: si === 0 ? 5 : si === 1 ? 4 : 3, yearsOfExperience: rndInt(1, 7) })) },
    }});

    await prisma.wallet.create({ data: {
      ownerType: 'AGENT', ownerId: ag.id, userId: agentUserRecords[i].id,
      balanceCents: BigInt(isApproved ? rndInt(2000, 50000) * 100 : 0),
      currency: 'KES', status: p.agStatus === 'SUSPENDED' ? 'FROZEN' : 'ACTIVE',
    }});

    if (isApproved) {
      await prisma.agentAvailabilitySlot.createMany({ data: [1,2,3,4,5].map(d => ({
        agentId: ag.id, dayOfWeek: d, startTime: '08:00', endTime: '17:00', timezone: 'Africa/Nairobi',
      }))});
    }
    return ag;
  }));

  const approvedAgents = agents.filter((_, i) => agentDefs[i].kyc === 'APPROVED');
  const acmeAgents  = agents.slice(0, 6);
  const swiftAgents = agents.slice(8, 14).filter(a => a.kycStatus === 'APPROVED');
  const nexusAgents = agents.slice(14, 21).filter(a => a.kycStatus === 'APPROVED');
  const peakAgents  = [agents[21], agents[23]];

  // ── 100 Tasks ─────────────────────────────────────────────────────────────────
  const taskTmpls = [
    { title: 'Handle tier-1 support tickets',           cat: 'customer-support', skills: ['customer-support','chat'] },
    { title: 'Outbound sales calls — fintech list',     cat: 'sales',            skills: ['sales','telemarketing'] },
    { title: 'CRM data entry from spreadsheet upload',  cat: 'data-entry',       skills: ['data-entry','excel'] },
    { title: 'Moderate community forum comments',       cat: 'moderation',       skills: ['moderation','social-media'] },
    { title: 'Transcribe customer feedback recordings', cat: 'research',         skills: ['research'] },
    { title: 'Email inbox triage and categorisation',   cat: 'customer-support', skills: ['email-support','customer-support'] },
    { title: 'KYC document verification batch',         cat: 'kyc',              skills: ['kyc-verification','compliance'] },
    { title: 'Social media response queue — Twitter',   cat: 'social-media',     skills: ['social-media','content'] },
    { title: 'Invoice reconciliation run — March',      cat: 'finance',          skills: ['finance','reconciliation'] },
    { title: 'Lead qualification — B2B cold list',      cat: 'sales',            skills: ['sales','crm'] },
    { title: 'Product catalogue data entry — 500 SKUs', cat: 'data-entry',       skills: ['data-entry','spreadsheets'] },
    { title: 'Voice follow-ups — Q2 churn cohort',      cat: 'sales',            skills: ['voice','telemarketing'] },
    { title: 'Insurance claims data processing',        cat: 'data-entry',       skills: ['data-entry','finance'] },
    { title: 'Content moderation — image batch',        cat: 'moderation',       skills: ['moderation'] },
    { title: 'Competitive pricing research analysis',   cat: 'research',         skills: ['research','report-writing'] },
    { title: 'ML annotation — text classification',     cat: 'annotation',       skills: ['data-entry','research'] },
    { title: 'CSAT survey follow-up calls',             cat: 'customer-support', skills: ['voice','customer-support'] },
    { title: 'LinkedIn lead scraping and enrichment',   cat: 'research',         skills: ['research','crm'] },
    { title: 'Back-office claims entry — healthcare',   cat: 'data-entry',       skills: ['data-entry','compliance'] },
    { title: 'Copywriting — product landing page',      cat: 'content',          skills: ['copywriting','content'] },
  ];

  const taskStatuses = ['PENDING','PENDING','ASSIGNED','IN_PROGRESS','IN_PROGRESS','UNDER_REVIEW','COMPLETED','COMPLETED','COMPLETED','FAILED','CANCELLED','ON_HOLD'];
  const allTaskIds: string[] = [];
  const completedTaskIds: string[] = [];
  const activeTaskIds: string[] = [];

  const bizConfig: Array<[any, any[], any[]]> = [
    [acme,  acmeWs,  acmeAgents],
    [swift, swiftWs, swiftAgents],
    [nexus, nexusWs, nexusAgents],
    [peak,  peakWs,  peakAgents],
  ];

  let tIdx = 0;
  for (const [biz, wsList, bizAgents] of bizConfig) {
    const owner = bizOwnerUsers[businesses.indexOf(biz)];
    for (let i = 0; i < 25; i++) {
      const tmpl     = taskTmpls[tIdx % taskTmpls.length];
      const ws       = wsList[i % wsList.length];
      const status   = taskStatuses[tIdx % taskStatuses.length] as any;
      const isCompleted = status === 'COMPLETED' || status === 'FAILED';
      const isActive    = status === 'IN_PROGRESS' || status === 'ASSIGNED' || status === 'UNDER_REVIEW';
      const isMkt       = tIdx % 4 === 0;
      const priority    = rnd(['LOW','MEDIUM','MEDIUM','HIGH','HIGH','URGENT']) as any;
      const daysOff     = rndInt(-30, 20);

      const task = await prisma.task.create({ data: {
        businessId: biz.id,
        workspaceId: ws.id,
        createdById: owner.id,
        title: `${tmpl.title} #${String(tIdx + 1).padStart(3, '0')}`,
        description: `This task requires ${tmpl.cat} expertise. Follow the SOP. SLA: ${rndInt(30, 240)} minutes. Escalate to supervisor if blocked >2 hrs.`,
        status, priority,
        category: tmpl.cat,
        requiredSkills: tmpl.skills,
        budgetCents: rndInt(5, 80) * 1000,
        currency: 'KES',
        slaMinutes: rndInt(30, 240),
        dueAt: daysFrom(daysOff),
        isMarketplace: isMkt,
        marketplaceStatus: isMkt ? 'APPROVED' : null,
        marketplaceExpiresAt: isMkt ? daysFrom(rndInt(3, 14)) : null,
        maxBids: isMkt ? 10 : null,
        startedAt: (isActive || isCompleted) ? hoursAgo(rndInt(2, 96)) : null,
        completedAt: isCompleted ? hoursAgo(rndInt(1, 48)) : null,
        cancelledAt: status === 'CANCELLED' ? hoursAgo(rndInt(1, 72)) : null,
        metadata: { tags: [tmpl.cat, priority.toLowerCase()], source: rnd(['internal','marketplace','api']) } as any,
      }});

      allTaskIds.push(task.id);
      if (isCompleted) completedTaskIds.push(task.id);
      if (isActive)    activeTaskIds.push(task.id);

      if ((isActive || isCompleted) && bizAgents.length > 0) {
        const agent = bizAgents[tIdx % bizAgents.length];
        await prisma.taskAssignment.create({ data: {
          taskId: task.id, agentId: agent.id,
          status: isCompleted ? 'COMPLETED' : 'ACCEPTED',
          acceptedAt: hoursAgo(rndInt(5, 100)),
          completedAt: isCompleted ? hoursAgo(rndInt(1, 48)) : null,
          notes: isCompleted ? 'Completed on time. Output meets QA standards.' : 'In progress.',
        }}).catch(() => {});
        await prisma.taskHistory.create({ data: {
          taskId: task.id, actorId: owner.id,
          fromStatus: 'PENDING', toStatus: 'ASSIGNED',
          note: 'Agent assigned by business owner', createdAt: hoursAgo(rndInt(50, 120)),
        }});
        if (isCompleted) {
          await prisma.taskHistory.create({ data: {
            taskId: task.id, actorId: owner.id,
            fromStatus: 'ASSIGNED', toStatus: 'COMPLETED',
            note: 'Marked complete after QA approval', createdAt: hoursAgo(rndInt(1, 48)),
          }});
        }
      }

      // Marketplace bids
      if (isMkt) {
        const bidCount = rndInt(2, 6);
        for (let b = 0; b < bidCount; b++) {
          const bidAgent = approvedAgents[(tIdx + b) % approvedAgents.length];
          if (!bidAgent) continue;
          const accepted = b === 0 && isCompleted;
          await prisma.bid.create({ data: {
            taskId: task.id, agentId: bidAgent.id,
            proposedCents: rndInt(4, 70) * 1000,
            coverNote: `I have ${rndInt(2, 7)} years hands-on experience in ${tmpl.cat}. Typical QA score: 4.5+. Can start immediately.`,
            estimatedDays: rndInt(1, 7),
            status: accepted ? 'ACCEPTED' : b % 5 === 0 ? 'REJECTED' : 'PENDING',
            acceptedAt: accepted ? hoursAgo(rndInt(5, 60)) : null,
            rejectedAt: (b % 5 === 0 && !accepted) ? hoursAgo(rndInt(5, 48)) : null,
          }}).catch(() => {});
        }
      }

      // Task submission for under_review / completed
      if ((isCompleted || status === 'UNDER_REVIEW') && bizAgents.length > 0) {
        const agent = bizAgents[tIdx % bizAgents.length];
        await prisma.taskSubmission.create({ data: {
          taskId: task.id, agentId: agent.id,
          round: 'FINAL', type: 'TEXT',
          content: `Completed ${rndInt(50, 250)} items. QC pass rate: ${rndInt(93, 100)}%. ${rndInt(0, 3)} escalations documented.`,
          notes: 'All work done per SOP. Ready for review.',
          status: isCompleted ? 'APPROVED' : 'UNDER_REVIEW',
          reviewNote: isCompleted ? 'Approved — good quality.' : null,
          reviewedAt: isCompleted ? hoursAgo(rndInt(1, 24)) : null,
        }}).catch(() => {});
      }

      tIdx++;
    }
  }

  // ── 40 Shifts ─────────────────────────────────────────────────────────────────
  const shiftSts = ['SCHEDULED','SCHEDULED','ACTIVE','COMPLETED','COMPLETED','COMPLETED','MISSED','CANCELLED'];
  for (let i = 0; i < 40; i++) {
    const bizIdx = i % 4;
    const biz    = businesses[bizIdx];
    const pool   = [acmeAgents, swiftAgents, nexusAgents, peakAgents][bizIdx];
    const agent  = pool[i % pool.length];
    const status = shiftSts[i % shiftSts.length] as any;
    const hOff   = status === 'COMPLETED' ? rndInt(25, 200) : status === 'ACTIVE' ? 2 : -rndInt(2, 48);
    const start  = hoursAgo(hOff);
    const end    = new Date(start.getTime() + rndInt(6, 10) * 3600_000);
    await prisma.shift.create({ data: {
      businessId: biz.id, agentId: agent.id,
      startAt: start, endAt: end, status,
      notes: status === 'MISSED' ? 'Agent no-show — no prior notice. HR flagged.'
           : status === 'COMPLETED' ? `Completed ${rndInt(95, 100)}% of tasks this shift.` : null,
    }});
  }

  // ── 20 Conversations + messages ──────────────────────────────────────────────
  const convoBodies = [
    ['Please start on ticket batch #247 right away — client SLA is 2 hours.', 'On it! Updating as I go.', 'Thanks. Client is watching closely.', 'Done — all 42 resolved. Summary sent to email.'],
    ['I need CRM access for this task.', 'Credentials sent to your registered email.', 'Got them, starting now.'],
    ['Prioritise the KYC batch — 4-hour SLA.', 'Working on it now.', 'First 50 done. Flagged 3 rejections.', 'Good. Clear the rest by 5pm.'],
    ['Your last submission had formatting errors in columns C–D.', 'Correcting now, will re-submit in one hour.', 'Resubmitted. Please check.', 'Looks good. Approved.'],
    ['Can we extend task #089 deadline by one day?', 'Approved. Please update the tracker.', 'Done, thank you!'],
    ['The March 15 call recording is missing from the system.', 'Checking with the tech team.', 'Found it — link added to task notes.'],
    ['Outstanding work this week! KES 2,500 bonus applied to your wallet.', 'Thank you so much!', 'Keep it up — you\'re top agent this month!'],
    ['LinkedIn scrape due by Friday COB.', '500 enriched leads ready by Thursday — buffer for review.', 'Perfect. Tag me when uploading.'],
  ];

  for (let i = 0; i < 20; i++) {
    const bizUser   = bizOwnerUsers[i % 4];
    const agentUser = agentUserRecords[i % agentUserRecords.length];
    const taskId    = allTaskIds[i * 5] ?? undefined;
    const bodies    = convoBodies[i % convoBodies.length];
    const convo = await prisma.conversation.create({ data: {
      type: taskId ? 'TASK' : 'DIRECT', taskId,
      title: `Thread ${i + 1}`,
      participants: { create: [{ userId: bizUser.id }, { userId: agentUser.id }] },
    }});
    for (let m = 0; m < bodies.length; m++) {
      await prisma.message.create({ data: {
        conversationId: convo.id,
        senderId: m % 2 === 0 ? bizUser.id : agentUser.id,
        type: 'TEXT', body: bodies[m],
        createdAt: hoursAgo(bodies.length - m + rndInt(0, 3)),
      }});
    }
  }

  // ── 100 Wallet transactions ───────────────────────────────────────────────────
  const txTypes = ['TASK_PAYMENT','TASK_PAYMENT','TASK_PAYMENT','TASK_PAYMENT','TOPUP','PAYOUT','COMMISSION','FEE'];
  for (let i = 0; i < 100; i++) {
    const agWallet = await prisma.wallet.findFirst({ where: { userId: agentUserRecords[i % agentUserRecords.length].id } });
    if (!agWallet || agWallet.status === 'FROZEN') continue;
    const type    = txTypes[i % txTypes.length] as any;
    const amt     = BigInt(rndInt(500, 10000) * 100);
    const dago    = rndInt(0, 90);
    await prisma.walletTransaction.create({ data: {
      walletId: agWallet.id, type, status: 'COMPLETED',
      amountCents: amt, currency: 'KES',
      reference: `TXN-${uid()}`,
      description: type === 'TASK_PAYMENT' ? `Task payment — job #${rndInt(100,999)}` : type === 'TOPUP' ? 'M-Pesa top-up via Paybill 898980' : type === 'PAYOUT' ? 'M-Pesa withdrawal' : type === 'COMMISSION' ? 'Platform commission' : 'Platform service fee',
      balanceAfterCents: BigInt(rndInt(1000, 80000) * 100),
      completedAt: daysAgo(dago),
      createdAt: daysAgo(dago),
    }});
  }

  // Also seed business wallet transactions
  for (let i = 0; i < 30; i++) {
    const biz    = businesses[i % 4];
    const bWallet = await prisma.wallet.findFirst({ where: { businessId: biz.id } });
    if (!bWallet) continue;
    const type = rnd(['CREDIT','DEBIT','FEE','TASK_PAYMENT']) as any;
    const amt  = BigInt(rndInt(5000, 100000) * 100);
    const dago = rndInt(0, 90);
    await prisma.walletTransaction.create({ data: {
      walletId: bWallet.id, type, status: 'COMPLETED',
      amountCents: amt, currency: 'KES',
      reference: `BTX-${uid()}`,
      description: type === 'CREDIT' ? 'Wallet top-up via bank transfer' : type === 'DEBIT' ? 'Agent payout released' : 'Platform subscription fee',
      balanceAfterCents: BigInt(rndInt(50000, 2000000) * 100),
      completedAt: daysAgo(dago), createdAt: daysAgo(dago),
    }});
  }

  // ── 25 Payouts ────────────────────────────────────────────────────────────────
  const payoutSts = ['PENDING','PROCESSING','COMPLETED','COMPLETED','COMPLETED','FAILED','CANCELLED'];
  let payoutCount = 0;
  for (let i = 0; i < agents.length && payoutCount < 25; i++) {
    const agent = agents[i];
    if (agent.kycStatus !== 'APPROVED') continue;
    const status = payoutSts[payoutCount % payoutSts.length] as any;
    await prisma.payout.create({ data: {
      agentId: agent.id,
      amountCents: BigInt(rndInt(2000, 25000) * 100),
      currency: 'KES', status,
      method: rnd(['mpesa','mpesa','bank_transfer']),
      destination: `+2547${rndInt(10,99)}${rndInt(100000,999999)}`,
      reference: `PAY-${uid()}`,
      processedAt: status === 'COMPLETED' ? daysAgo(rndInt(1, 30)) : null,
      createdAt: daysAgo(rndInt(1, 60)),
      metadata: { channel: 'M-Pesa', initiatedBy: 'agent' } as any,
    }});
    payoutCount++;
  }

  // ── 24 Invoices ───────────────────────────────────────────────────────────────
  const invSts = ['DRAFT','ISSUED','ISSUED','PAID','PAID','PAID','OVERDUE','CANCELLED'];
  for (let i = 0; i < 24; i++) {
    const biz = businesses[i % 4];
    const amt = BigInt(rndInt(10000, 150000) * 100);
    const tax = amt * 16n / 100n;
    const status = invSts[i % invSts.length] as any;
    const dago = rndInt(5, 90);
    await prisma.invoice.create({ data: {
      businessId: biz.id,
      number: `INV-2026-${String(i + 1).padStart(4, '0')}`,
      amountCents: amt, taxCents: tax, totalCents: amt + tax,
      currency: 'KES', status,
      issuedAt: status !== 'DRAFT' ? daysAgo(dago) : null,
      dueAt: daysFrom(status === 'OVERDUE' ? -rndInt(1, 30) : rndInt(5, 30)),
      paidAt: status === 'PAID' ? daysAgo(rndInt(1, dago)) : null,
      lineItems: [
        { description: 'Platform subscription', quantity: 1, unitPrice: Number(amt) },
        { description: 'VAT 16%',               quantity: 1, unitPrice: Number(tax) },
      ] as any,
      metadata: { month: rnd(['January','February','March','April']), year: 2026 } as any,
    }});
  }

  // ── 30 QA Reviews ────────────────────────────────────────────────────────────
  const qaComments = [
    'Excellent quality. Professional tone throughout. Recommend for performance bonus.',
    'Good work but minor formatting errors in columns C and D.',
    'Above SLA by 23 minutes. CSAT score: 9.4/10.',
    'Minor category tagging errors — otherwise solid. Score: 4/5.',
    'Outstanding. Accuracy 99.2%. Zero escalations. Top performer this cycle.',
    'Below expectations — missed 3 SLA windows. Formatting inconsistent.',
    'Satisfactory. Met SLA, complete output. Room to improve on tone.',
    'All 200 annotation tasks: <1% error rate. Exceptional.',
  ];

  const reviewerPool = [...supervisorUsers, adminUser];
  for (let i = 0; i < 30; i++) {
    const taskId   = completedTaskIds[i % Math.max(completedTaskIds.length, 1)] ?? allTaskIds[i % allTaskIds.length];
    const agent    = approvedAgents[i % approvedAgents.length];
    if (!agent) continue;
    const reviewer = reviewerPool[i % reviewerPool.length];
    const score    = rndInt(2, 5);
    await prisma.qAReview.create({ data: {
      taskId, agentId: agent.id, reviewerId: reviewer.id,
      score, comment: qaComments[i % qaComments.length],
      criteria: {
        accuracy:   rndInt(Math.max(1, score-1), Math.min(5, score+1)),
        tone:       rndInt(Math.max(1, score-1), Math.min(5, score+1)),
        speed:      rndInt(Math.max(1, score-1), Math.min(5, score+1)),
        compliance: rndInt(Math.max(1, score-1), Math.min(5, score+1)),
        sla_met:    score >= 4,
      } as any,
    }}).catch(() => {});
  }

  // ── 30 Performance metrics (3 months per agent) ──────────────────────────────
  for (let i = 0; i < 30; i++) {
    const agent = approvedAgents[i % approvedAgents.length];
    if (!agent || agent.totalTasks === 0) continue;
    const mo     = (i % 3) * 30;
    const pStart = daysAgo(mo + 30);
    const pEnd   = daysAgo(mo);
    await prisma.performanceMetric.create({ data: {
      agentId: agent.id,
      periodStart: pStart, periodEnd: pEnd,
      tasksCompleted: rndInt(10, 80),
      tasksFailed: rndInt(0, 5),
      avgRating: new Prisma.Decimal(rndInt(30, 50) / 10),
      avgResponseSec: rndInt(120, 3600),
      slaBreaches: rndInt(0, 4),
      revenueCents: BigInt(rndInt(5000, 60000) * 100),
    }}).catch(() => {});
  }

  // ── 8 Disputes with thread messages ──────────────────────────────────────────
  const disputeDefs = [
    {
      filedBy: agentUserRecords[0], task: 0, cat: 'PAYMENT', status: 'OPEN', priority: 'HIGH',
      sub: 'Underpayment — task #001 completed but only partial payment released',
      desc: 'I completed the full batch of 150 tickets within SLA. Only KES 3,200 was released instead of the agreed KES 5,000.',
      msgs: [
        { by: 'admin', body: 'Payment was released based on pro-rated completion percentage. We are reviewing the full batch logs.' },
        { by: 'filer', body: 'My QA score was 4.8 — full SLA met. Full payment should be released.' },
        { by: 'admin', body: 'We have confirmed the full completion. Additional KES 1,800 has been approved.' },
      ],
    },
    {
      filedBy: bizOwnerUsers[0], task: 4, cat: 'TASK_QUALITY', status: 'IN_PROGRESS', priority: 'HIGH',
      sub: 'Agent submitted only 40% of required batch',
      desc: 'The agent submitted 60 of 150 required transcriptions and marked the task complete. Quality of submitted work is also below 70% threshold.',
      msgs: [
        { by: 'admin', body: 'We have reviewed the submission. Agent will be required to complete the remaining 60%.' },
        { by: 'filer', body: 'The full file set was not provided to me on day one. Screenshots attached.' },
        { by: 'admin', body: 'File upload logs confirm the full set was uploaded at 09:12 on task creation day. Agent must complete remaining work.' },
      ],
    },
    {
      filedBy: agentUserRecords[5], task: 9, cat: 'AGENT_CONDUCT', status: 'UNDER_REVIEW', priority: 'URGENT',
      sub: 'Supervisor sending messages outside contracted working hours',
      desc: 'The supervisor has been sending work requests via WhatsApp between 10pm–1am. I have documented 17 instances over 2 weeks.',
      msgs: [
        { by: 'admin', body: 'HR has been notified and is reviewing the communication logs. Thank you for raising this.' },
        { by: 'filer', body: 'I can provide screenshots for each instance if needed.' },
        { by: 'admin', body: 'Screenshots received. Formal investigation initiated. Resolution expected within 72 hours.', internal: true },
      ],
    },
    {
      filedBy: bizOwnerUsers[1], task: 6, cat: 'PAYMENT', status: 'RESOLVED', priority: 'MEDIUM',
      sub: 'Duplicate charge — INV-2026-0003 and INV-2026-0004 are identical',
      desc: 'We were billed twice for the March subscription. Both invoices are for KES 7,999. Please refund the duplicate.',
      resolution: 'Confirmed billing system error. KES 7,999 refund processed to business wallet. Bug patched in billing service.',
      msgs: [
        { by: 'admin', body: 'Confirmed — duplicate invoice raised due to a billing system bug. Refund of KES 7,999 has been processed.' },
        { by: 'filer', body: 'Refund received. Thank you for resolving this quickly.' },
      ],
    },
    {
      filedBy: bizOwnerUsers[2], task: 12, cat: 'TASK_QUALITY', status: 'ESCALATED', priority: 'URGENT',
      sub: 'Dataset error rate 8.3% — contract requires <2%',
      desc: 'Delivered dataset has 8.3% error rate on internal QA. Contract specifies <2%. Requesting full re-annotation at no additional charge.',
      msgs: [
        { by: 'admin', body: 'Escalated to our Enterprise CS team. Dedicated reviewer will contact you within 24 hours.' },
        { by: 'filer', body: 'Our SLA guarantees resolution within 48 hours. Please confirm timeline.' },
        { by: 'admin', body: 'Senior QA team reviewing now. Interim report by EOD today.', internal: true },
      ],
    },
    {
      filedBy: agentUserRecords[3], task: 3, cat: 'BUSINESS_CONDUCT', status: 'OPEN', priority: 'MEDIUM',
      sub: 'Task requirements changed after acceptance without budget adjustment',
      desc: 'Original brief specified 50 outbound calls. After I started, the requirement was changed to 200 calls with no budget change.',
      msgs: [
        { by: 'admin', body: 'Reviewing task edit history to verify the original requirements at time of acceptance.' },
        { by: 'filer', body: 'I have a screenshot of the original task brief showing 50 calls.' },
      ],
    },
    {
      filedBy: agentUserRecords[6], task: 15, cat: 'PAYMENT', status: 'IN_PROGRESS', priority: 'HIGH',
      sub: 'Payout delayed beyond 48-hour processing window',
      desc: 'Withdrawal of KES 12,500 requested on April 10. Still pending April 15. Reference: PAY-ABC123.',
      msgs: [
        { by: 'admin', body: 'Checking with the payments team now.' },
        { by: 'admin', body: 'Payout was flagged by our fraud detection model. Now cleared — funds will arrive within 6 hours.' },
        { by: 'filer', body: 'Funds received. Thank you.' },
      ],
    },
    {
      filedBy: agentUserRecords[1], task: 20, cat: 'OTHER', status: 'OPEN', priority: 'MEDIUM',
      sub: 'Task cancelled after 6 hours of completed work with no compensation',
      desc: 'Completed 6 hours of work when task was suddenly cancelled. No notification and no partial payment offered.',
      msgs: [
        { by: 'admin', body: 'The task was cancelled due to client withdrawal. We are reviewing eligibility for partial compensation based on work logged.' },
      ],
    },
  ];

  for (const d of disputeDefs) {
    const taskId = allTaskIds[d.task % allTaskIds.length];
    const dispute = await prisma.dispute.create({ data: {
      filedById: d.filedBy.id, taskId,
      category: d.cat as any, status: d.status as any, priority: d.priority as any,
      subject: d.sub, description: d.desc,
      resolution: (d as any).resolution ?? null,
      resolvedAt: d.status === 'RESOLVED' ? daysAgo(rndInt(1, 10)) : null,
    }});
    for (let m = 0; m < d.msgs.length; m++) {
      const msg = d.msgs[m];
      const author = msg.by === 'admin' ? adminUser : d.filedBy;
      await prisma.ticketMessage.create({ data: {
        disputeId: dispute.id, authorId: author.id,
        body: msg.body, internal: (msg as any).internal ?? false,
        createdAt: hoursAgo(d.msgs.length - m + rndInt(0, 4)),
      }});
    }
  }

  // ── 80 Notifications ─────────────────────────────────────────────────────────
  const notifTmpls = [
    { title: 'New task available',          body: 'A task matching your skills has been posted: "Handle tier-1 support tickets". Budget: KES 4,500.',       channel: 'IN_APP' },
    { title: 'Task completed ✓',            body: 'Your task was marked complete. Payment of KES 3,200 is being processed to your wallet.',                   channel: 'IN_APP' },
    { title: 'Payment received',            body: 'KES 5,600 has been added to your WorkStream wallet. Reference: TXN-A89B2C.',                              channel: 'PUSH'   },
    { title: 'New bid on your listing',     body: 'Ann Njoroge has placed a bid of KES 7,200 on your marketplace listing. Review now.',                       channel: 'IN_APP' },
    { title: 'Shift starting in 30 min',   body: 'Your shift at Acme BPO Kenya begins at 08:00. Log in to the agent dashboard.',                             channel: 'PUSH'   },
    { title: 'QA review ready',             body: 'Your QA score for the April batch is ready. Score: 4.7/5. View detailed feedback.',                        channel: 'IN_APP' },
    { title: 'KYC approved ✓',              body: 'Your identity verification has been approved. You can now accept tasks on the platform.',                  channel: 'EMAIL'  },
    { title: 'Dispute update',              body: 'Your dispute #DIS-2026-004 has been updated. Admin has added a response — view thread.',                   channel: 'IN_APP' },
    { title: 'Wallet top-up confirmed',     body: 'KES 10,000 has been successfully loaded to your wallet via M-Pesa.',                                       channel: 'PUSH'   },
    { title: 'New agent joined workspace',  body: 'Felix Owino has joined your Tier-1 Support workspace and is ready to accept tasks.',                       channel: 'IN_APP' },
    { title: '⚠ SLA breach alert',          body: 'Task #057 has breached its 2-hour SLA. Immediate supervisor attention required.',                          channel: 'EMAIL'  },
    { title: 'Subscription renews in 7d',  body: 'Your Growth plan renews in 7 days. Next invoice: KES 7,999. Ensure wallet balance is sufficient.',          channel: 'EMAIL'  },
    { title: 'Payout processed',            body: 'Your withdrawal of KES 8,500 has been sent to +254722000001 via M-Pesa. ETA: 5 minutes.',                 channel: 'PUSH'   },
    { title: 'Bid accepted 🎉',             body: 'Your bid on "Lead qualification — B2B cold list" was accepted. Start date: immediately.',                  channel: 'IN_APP' },
    { title: 'Performance report ready',    body: 'Your April performance report is available. Completed: 47 tasks. Avg rating: 4.8/5.',                      channel: 'EMAIL'  },
    { title: 'KYC document rejected',       body: 'Your KYC document submission was rejected. Reason: blurry ID scan. Please resubmit a clear photo.',       channel: 'EMAIL'  },
    { title: 'Task assigned to you',        body: 'You have been assigned "Invoice reconciliation run — March". Due in 4 hours. Check your task board.',      channel: 'PUSH'   },
    { title: 'New message',                 body: 'Alice Munene sent you a message: "Please start on ticket batch #247 right away."',                         channel: 'IN_APP' },
  ];

  const notifTargets = [...agentUserRecords, ...bizOwnerUsers, ...supervisorUsers, adminUser];
  for (let i = 0; i < 80; i++) {
    const user   = notifTargets[i % notifTargets.length];
    const tmpl   = notifTmpls[i % notifTmpls.length];
    const status = rnd(['SENT','SENT','READ','READ','READ','PENDING']) as any;
    await prisma.notification.create({ data: {
      userId: user.id, title: tmpl.title, body: tmpl.body,
      channel: tmpl.channel as any, status,
      readAt:  status === 'READ'    ? hoursAgo(rndInt(1, 48)) : null,
      sentAt:  status !== 'PENDING' ? hoursAgo(rndInt(1, 72)) : null,
      link: '/dashboard',
      createdAt: hoursAgo(rndInt(1, 168)),
    }});
  }

  // ── 60 Audit logs ─────────────────────────────────────────────────────────────
  const auditDefs = [
    { action: 'USER_LOGIN',             entity: 'User',        sev: 'INFO'     },
    { action: 'USER_LOGOUT',            entity: 'User',        sev: 'INFO'     },
    { action: 'TASK_CREATED',           entity: 'Task',        sev: 'INFO'     },
    { action: 'TASK_ASSIGNED',          entity: 'Task',        sev: 'INFO'     },
    { action: 'TASK_COMPLETED',         entity: 'Task',        sev: 'INFO'     },
    { action: 'TASK_CANCELLED',         entity: 'Task',        sev: 'WARN'     },
    { action: 'PAYMENT_PROCESSED',      entity: 'Payment',     sev: 'INFO'     },
    { action: 'PAYOUT_INITIATED',       entity: 'Payout',      sev: 'INFO'     },
    { action: 'PAYOUT_FAILED',          entity: 'Payout',      sev: 'WARN'     },
    { action: 'DISPUTE_OPENED',         entity: 'Dispute',     sev: 'WARN'     },
    { action: 'DISPUTE_RESOLVED',       entity: 'Dispute',     sev: 'INFO'     },
    { action: 'KYC_SUBMITTED',          entity: 'Agent',       sev: 'INFO'     },
    { action: 'KYC_APPROVED',           entity: 'Agent',       sev: 'INFO'     },
    { action: 'KYC_REJECTED',           entity: 'Agent',       sev: 'WARN'     },
    { action: 'AGENT_SUSPENDED',        entity: 'Agent',       sev: 'WARN'     },
    { action: 'BUSINESS_APPROVED',      entity: 'Business',    sev: 'INFO'     },
    { action: 'FEATURE_FLAG_TOGGLED',   entity: 'FeatureFlag', sev: 'WARN'     },
    { action: 'SUBSCRIPTION_UPGRADED',  entity: 'Business',    sev: 'INFO'     },
    { action: 'INVOICE_ISSUED',         entity: 'Invoice',     sev: 'INFO'     },
    { action: 'ADMIN_OVERRIDE',         entity: 'Task',        sev: 'CRITICAL' },
  ];

  const auditActors = [...bizOwnerUsers, ...agentUserRecords.slice(0, 6), adminUser];
  for (let i = 0; i < 60; i++) {
    const def    = auditDefs[i % auditDefs.length];
    const actor  = auditActors[i % auditActors.length];
    const entId  = allTaskIds[i % allTaskIds.length] ?? actor.id;
    await prisma.auditLog.create({ data: {
      actorId: actor.id,
      entityType: def.entity, entityId: entId,
      action: def.action, severity: def.sev as any,
      ipAddress: `41.${rndInt(200,250)}.${rndInt(1,255)}.${rndInt(1,255)}`,
      userAgent: rnd(['Mozilla/5.0 (Windows NT 10.0; Win64; x64)','Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)','WorkStream-Flutter/2.4']),
      metadata: { source: rnd(['web','mobile','api']), reason: 'Routine action' } as any,
      createdAt: daysAgo(rndInt(0, 90)),
    }});
  }

  // ── 12 Feature flags ──────────────────────────────────────────────────────────
  await prisma.featureFlag.createMany({ data: [
    { key: 'voice-calls',           enabled: true,  rolloutPct: 100, description: 'In-app voice calls between agents and businesses' },
    { key: 'video-calls',           enabled: false, rolloutPct: 0,   description: 'In-app video calls — beta, not yet released' },
    { key: 'ai-task-routing',       enabled: false, rolloutPct: 0,   description: 'AI-powered agent matching and auto-assignment' },
    { key: 'auto-qa-scoring',       enabled: false, rolloutPct: 10,  description: 'Automated QA scoring via LLM (10% rollout beta)' },
    { key: 'marketplace-bidding',   enabled: true,  rolloutPct: 100, description: 'Allow verified freelance agents to bid on marketplace tasks' },
    { key: 'wallet-payouts',        enabled: true,  rolloutPct: 100, description: 'M-Pesa wallet withdrawals for agents' },
    { key: 'shift-scheduler',       enabled: true,  rolloutPct: 100, description: 'Shift scheduling and management module' },
    { key: 'performance-dashboard', enabled: true,  rolloutPct: 100, description: 'Agent performance analytics dashboard' },
    { key: 'bulk-task-import',      enabled: false, rolloutPct: 0,   description: 'CSV bulk task import (enterprise only, not yet live)' },
    { key: 'sla-alerts',            enabled: true,  rolloutPct: 100, description: 'Real-time SLA breach notifications' },
    { key: 'multi-workspace',       enabled: true,  rolloutPct: 100, description: 'Multiple workspaces per business' },
    { key: 'api-access',            enabled: false, rolloutPct: 0,   description: 'REST API keys for enterprise integrations' },
  ]});

  // ── 20 System settings ────────────────────────────────────────────────────────
  await prisma.systemSetting.createMany({ data: [
    { key: 'pricing.platform_fee_pct',      value: 10 as any,                     category: 'pricing'       },
    { key: 'pricing.min_payout_amount',     value: 1000 as any,                   category: 'pricing'       },
    { key: 'pricing.max_payout_amount',     value: 500000 as any,                 category: 'pricing'       },
    { key: 'pricing.payout_currencies',     value: ['KES','USD','EUR'] as any,    category: 'pricing'       },
    { key: 'sla.dispute_hours',             value: 48 as any,                     category: 'sla'           },
    { key: 'sla.support_hours',             value: 24 as any,                     category: 'sla'           },
    { key: 'sla.kyc_hours',                 value: 12 as any,                     category: 'sla'           },
    { key: 'sla.task_assignment_hours',     value: 4 as any,                      category: 'sla'           },
    { key: 'notifications.emailEnabled',    value: true as any,                   category: 'notifications' },
    { key: 'notifications.smsEnabled',      value: true as any,                   category: 'notifications' },
    { key: 'notifications.pushEnabled',     value: true as any,                   category: 'notifications' },
    { key: 'security.sessionTimeoutMins',   value: 60 as any,                     category: 'security'      },
    { key: 'security.maxLoginAttempts',     value: 5 as any,                      category: 'security'      },
    { key: 'security.mfaRequired',          value: false as any,                  category: 'security'      },
    { key: 'payments.mpesaShortcode',       value: '898980' as any,               category: 'integrations'  },
    { key: 'payments.mpesaConsumerKey',     value: 'mpesa-ck-placeholder' as any, category: 'integrations'  },
    { key: 'payments.brevoApiKey',          value: 'brevo-placeholder' as any,    category: 'integrations'  },
    { key: 'platform.appVersion',           value: '2.4.1' as any,                category: 'platform'      },
    { key: 'platform.maintenanceMode',      value: false as any,                  category: 'platform'      },
    { key: 'platform.maxAgentsPerBusiness', value: 100 as any,                    category: 'platform'      },
  ]});

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n✅ Ultra-fat seed complete!\n');
  console.log('📦  4 businesses × 4 plans (Free/Starter/Growth/Enterprise)');
  console.log('     Acme BPO Kenya    — Growth     — alice@acmebpo.co.ke');
  console.log('     SwiftOps Ltd      — Starter    — david@swiftops.co.ke');
  console.log('     Nexus Data Svcs   — Enterprise — priya@nexusdata.co.ke');
  console.log('     PeakSales Africa  — Free       — kofi@peaksales.africa');
  console.log('📦  13 workspaces (4+3+4+2)');
  console.log('📦  26 agents (16 APPROVED, 3 PENDING KYC, 3 REJECTED, 4 NOT_SUBMITTED)');
  console.log('📦  100 tasks (25 marketplace with 2–6 bids each)');
  console.log('📦  40 shifts · 20 conversations · 100 agent txns · 30 biz txns');
  console.log('📦  25 payouts · 24 invoices · 30 QA reviews · 30 perf metrics');
  console.log('📦  8 disputes with full message threads');
  console.log('📦  80 notifications · 60 audit logs · 12 feature flags · 20 settings');
  console.log('\n🔐  All passwords: Password123!\n');
  console.log('  admin@workstream.io          ADMIN');
  console.log('  alice@acmebpo.co.ke          BUSINESS (Acme BPO — Growth)');
  console.log('  david@swiftops.co.ke         BUSINESS (SwiftOps — Starter)');
  console.log('  priya@nexusdata.co.ke        BUSINESS (Nexus Data — Enterprise)');
  console.log('  kofi@peaksales.africa        BUSINESS (PeakSales — Free)');
  console.log('  brian@acmebpo.co.ke          SUPERVISOR (Acme)');
  console.log('  ann@agent.io                 AGENT — 4.9★ 212 tasks (top)');
  console.log('  mary@agent.io                AGENT — 4.9★ 201 tasks');
  console.log('  jane@agent.io                AGENT — 4.8★ 143 tasks');
  console.log('  felix@agent.io               AGENT — KYC PENDING (KYC queue)');
  console.log('  emma@agent.io                AGENT — KYC REJECTED + SUSPENDED');
  console.log('  benjaminkakaimasai@gmail.com BUSINESS (co-owner Acme)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
