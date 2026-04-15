import { Controller, Get, Post, Headers, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

const SEED_KEY = process.env.SEED_SECRET ?? 'ws-seed-2026-ultra';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      services: { database: dbOk ? 'ok' : 'unreachable' },
    };
  }

  // ── One-time seed endpoint (key-protected, no auth required) ─────────────────
  @Post('seed')
  async runSeed(@Headers('x-seed-key') key: string) {
    if (key !== SEED_KEY) throw new ForbiddenException('Invalid seed key');

    const pw = await bcrypt.hash('Password123!', 10);

    function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
    function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function daysAgo(n: number) { return new Date(Date.now() - n * 86400_000); }
    function hoursAgo(n: number) { return new Date(Date.now() - n * 3600_000); }
    function daysFrom(n: number) { return new Date(Date.now() + n * 86400_000); }
    function uid() { return Math.random().toString(36).slice(2, 10).toUpperCase(); }

    // ── Clear ALL ────────────────────────────────────────────────────────────────
    await this.prisma.ticketMessage.deleteMany().catch(() => {});
    await this.prisma.dispute.deleteMany();
    await this.prisma.taskSubmission.deleteMany();
    await this.prisma.qAReview.deleteMany();
    await this.prisma.performanceMetric.deleteMany();
    await this.prisma.bid.deleteMany();
    await this.prisma.taskAssignment.deleteMany();
    await this.prisma.taskHistory.deleteMany();
    await this.prisma.task.deleteMany();
    await this.prisma.walletTransaction.deleteMany();
    await this.prisma.payout.deleteMany();
    await this.prisma.wallet.deleteMany();
    await this.prisma.invoice.deleteMany();
    await this.prisma.shift.deleteMany();
    await this.prisma.callSession.deleteMany();
    await this.prisma.message.deleteMany();
    await this.prisma.conversationParticipant.deleteMany();
    await this.prisma.conversation.deleteMany();
    await this.prisma.agentAvailabilitySlot.deleteMany();
    await this.prisma.agentSkill.deleteMany();
    await this.prisma.agent.deleteMany();
    await this.prisma.businessMember.deleteMany();
    await this.prisma.workspace.deleteMany();
    await this.prisma.business.deleteMany();
    await this.prisma.notification.deleteMany();
    await this.prisma.auditLog.deleteMany();
    await this.prisma.featureFlag.deleteMany();
    await this.prisma.systemSetting.deleteMany();
    await this.prisma.passwordResetToken.deleteMany();
    await this.prisma.userSession.deleteMany();
    await this.prisma.mediaAsset.deleteMany();
    await this.prisma.subscriptionPlan.deleteMany();
    await this.prisma.user.deleteMany();

    // ── Plans ────────────────────────────────────────────────────────────────────
    const [planFree, planStarter, planGrowth, planEnterprise] = await Promise.all([
      this.prisma.subscriptionPlan.create({ data: { name: 'Free',       priceCents: 0,       currency: 'KES', description: '25 tasks/month, 2 agents',                  features: { tasks: 25,  seats: 2,  sla: false, qa: false, api: false } } }),
      this.prisma.subscriptionPlan.create({ data: { name: 'Starter',    priceCents: 299900,  currency: 'KES', description: '200 tasks/month, 10 agents, SLA',            features: { tasks: 200, seats: 10, sla: true,  qa: false, api: false } } }),
      this.prisma.subscriptionPlan.create({ data: { name: 'Growth',     priceCents: 799900,  currency: 'KES', description: 'Unlimited tasks, 25 agents, SLA + QA',       features: { tasks: -1,  seats: 25, sla: true,  qa: true,  api: false } } }),
      this.prisma.subscriptionPlan.create({ data: { name: 'Enterprise', priceCents: 2499900, currency: 'KES', description: 'Unlimited + dedicated CSM + API',            features: { tasks: -1,  seats: -1, sla: true,  qa: true,  api: true, csm: true } } }),
    ]);

    // ── Admin + Benjamin ──────────────────────────────────────────────────────────
    const adminUser = await this.prisma.user.create({ data: {
      email: 'admin@workstream.io', phone: '+254700000001', passwordHash: pw,
      firstName: 'System', lastName: 'Admin', name: 'System Admin',
      role: 'ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true, lastLoginAt: hoursAgo(2),
    }});

    await this.prisma.user.upsert({
      where: { email: 'benjaminkakaimasai@gmail.com' },
      update: { passwordHash: pw },
      create: {
        email: 'benjaminkakaimasai@gmail.com', phone: '+254700000099', passwordHash: pw,
        firstName: 'Benjamin', lastName: 'Kakai', name: 'Benjamin Kakai',
        role: 'BUSINESS', status: 'ACTIVE', emailVerified: true, phoneVerified: true, lastLoginAt: hoursAgo(1),
      },
    });

    // ── 4 owners + 4 supervisors ─────────────────────────────────────────────────
    const ownerDefs = [
      { email: 'alice@acmebpo.co.ke',    phone: '+254711000001', first: 'Alice',  last: 'Munene'  },
      { email: 'david@swiftops.co.ke',   phone: '+254711000002', first: 'David',  last: 'Njoroge' },
      { email: 'priya@nexusdata.co.ke',  phone: '+254711000003', first: 'Priya',  last: 'Patel'   },
      { email: 'kofi@peaksales.africa',  phone: '+254711000004', first: 'Kofi',   last: 'Asante'  },
    ];
    const supDefs = [
      { email: 'brian@acmebpo.co.ke',    phone: '+254711000010', first: 'Brian',  last: 'Otieno'  },
      { email: 'sylvia@swiftops.co.ke',  phone: '+254711000011', first: 'Sylvia', last: 'Wambua'  },
      { email: 'mark@nexusdata.co.ke',   phone: '+254711000012', first: 'Mark',   last: 'Omondi'  },
      { email: 'naomi@peaksales.africa', phone: '+254711000013', first: 'Naomi',  last: 'Kibet'   },
    ];

    const bizOwnerUsers = await Promise.all(ownerDefs.map(d => this.prisma.user.create({ data: {
      email: d.email, phone: d.phone, passwordHash: pw,
      firstName: d.first, lastName: d.last, name: `${d.first} ${d.last}`,
      role: 'BUSINESS', status: 'ACTIVE', emailVerified: true, phoneVerified: true, lastLoginAt: daysAgo(rndInt(0, 3)),
    }})));
    const supervisorUsers = await Promise.all(supDefs.map(d => this.prisma.user.create({ data: {
      email: d.email, phone: d.phone, passwordHash: pw,
      firstName: d.first, lastName: d.last, name: `${d.first} ${d.last}`,
      role: 'SUPERVISOR', status: 'ACTIVE', emailVerified: true, phoneVerified: true, lastLoginAt: daysAgo(rndInt(0, 2)),
    }})));

    // ── 4 Businesses ─────────────────────────────────────────────────────────────
    const bizDefs = [
      { name: 'Acme BPO Kenya',      slug: 'acme-bpo-kenya',      industry: 'Customer Support / BPO',  plan: planGrowth,     wallet: 12_500_000n, desc: 'East Africa\'s fastest-growing BPO firm serving fintech, FMCG and telecom.' },
      { name: 'SwiftOps Ltd',        slug: 'swiftops-ltd',        industry: 'Back-Office Operations',  plan: planStarter,    wallet: 4_500_000n,  desc: 'Specialised in insurance claims processing and back-office ops for banking.' },
      { name: 'Nexus Data Services', slug: 'nexus-data-services', industry: 'Data Entry & Processing', plan: planEnterprise, wallet: 28_000_000n, desc: 'High-accuracy data entry, ETL pipelines and ML annotation services.' },
      { name: 'PeakSales Africa',    slug: 'peaksales-africa',    industry: 'Sales & Telemarketing',   plan: planFree,       wallet: 750_000n,    desc: 'Outbound sales campaigns, lead qualification and CRM management.' },
    ];
    const businesses = await Promise.all(bizDefs.map((d, i) => this.prisma.business.create({ data: {
      name: d.name, slug: d.slug, industry: d.industry, description: d.desc,
      website: `https://${d.slug}.co.ke`, contactEmail: ownerDefs[i].email, contactPhone: ownerDefs[i].phone,
      status: 'ACTIVE', planId: d.plan.id,
    }})));
    const [acme, swift, nexus, peak] = businesses;

    await Promise.all(businesses.map((b, i) => this.prisma.wallet.create({ data: {
      ownerType: 'BUSINESS', ownerId: b.id, businessId: b.id,
      balanceCents: bizDefs[i].wallet, currency: 'KES', status: 'ACTIVE',
    }})));

    // ── Workspaces ────────────────────────────────────────────────────────────────
    const acmeWs = await Promise.all([
      this.prisma.workspace.create({ data: { businessId: acme.id, name: 'Tier-1 Support',    description: 'General customer queries — phone, email, chat', timezone: 'Africa/Nairobi', currency: 'KES' } }),
      this.prisma.workspace.create({ data: { businessId: acme.id, name: 'Tier-2 Escalations', description: 'Complex escalations and complaint resolution',   timezone: 'Africa/Nairobi', currency: 'KES' } }),
      this.prisma.workspace.create({ data: { businessId: acme.id, name: 'Sales Ops',          description: 'Outbound sales and lead follow-up',              timezone: 'Africa/Nairobi', currency: 'KES' } }),
      this.prisma.workspace.create({ data: { businessId: acme.id, name: 'KYC Desk',           description: 'Document review and identity verification',      timezone: 'Africa/Nairobi', currency: 'KES' } }),
    ]);
    const swiftWs = await Promise.all([
      this.prisma.workspace.create({ data: { businessId: swift.id, name: 'Claims Processing', description: 'Insurance and banking claims',          timezone: 'Africa/Nairobi', currency: 'KES' } }),
      this.prisma.workspace.create({ data: { businessId: swift.id, name: 'Finance Desk',      description: 'Invoice and payment reconciliation',   timezone: 'Africa/Nairobi', currency: 'KES' } }),
      this.prisma.workspace.create({ data: { businessId: swift.id, name: 'Back-Office Alpha', description: 'Data entry and processing queue',      timezone: 'Africa/Nairobi', currency: 'KES' } }),
    ]);
    const nexusWs = await Promise.all([
      this.prisma.workspace.create({ data: { businessId: nexus.id, name: 'Data Ops',        description: 'ETL pipelines and structured data entry',              timezone: 'Africa/Nairobi', currency: 'KES' } }),
      this.prisma.workspace.create({ data: { businessId: nexus.id, name: 'ML Annotation',   description: 'Image, text and audio annotation for AI training',     timezone: 'Africa/Nairobi', currency: 'KES' } }),
      this.prisma.workspace.create({ data: { businessId: nexus.id, name: 'Research Desk',   description: 'Web research and data collection',                     timezone: 'Africa/Nairobi', currency: 'KES' } }),
      this.prisma.workspace.create({ data: { businessId: nexus.id, name: 'QA & Validation', description: 'Quality assurance on delivered datasets',              timezone: 'Africa/Nairobi', currency: 'KES' } }),
    ]);
    const peakWs = await Promise.all([
      this.prisma.workspace.create({ data: { businessId: peak.id, name: 'Outbound Sales', description: 'Cold calling and prospect qualification',   timezone: 'Africa/Nairobi', currency: 'KES' } }),
      this.prisma.workspace.create({ data: { businessId: peak.id, name: 'CRM Management', description: 'HubSpot and Salesforce data management',    timezone: 'Africa/Nairobi', currency: 'KES' } }),
    ]);

    // ── Business members ──────────────────────────────────────────────────────────
    await this.prisma.businessMember.createMany({ data: [
      { businessId: acme.id,  userId: bizOwnerUsers[0].id,   workspaceId: acmeWs[0].id,  role: 'OWNER',      joinedAt: daysAgo(120) },
      { businessId: acme.id,  userId: supervisorUsers[0].id, workspaceId: acmeWs[0].id,  role: 'SUPERVISOR', joinedAt: daysAgo(90)  },
      { businessId: swift.id, userId: bizOwnerUsers[1].id,   workspaceId: swiftWs[0].id, role: 'OWNER',      joinedAt: daysAgo(60)  },
      { businessId: swift.id, userId: supervisorUsers[1].id, workspaceId: swiftWs[0].id, role: 'SUPERVISOR', joinedAt: daysAgo(45)  },
      { businessId: nexus.id, userId: bizOwnerUsers[2].id,   workspaceId: nexusWs[0].id, role: 'OWNER',      joinedAt: daysAgo(80)  },
      { businessId: nexus.id, userId: supervisorUsers[2].id, workspaceId: nexusWs[0].id, role: 'SUPERVISOR', joinedAt: daysAgo(60)  },
      { businessId: peak.id,  userId: bizOwnerUsers[3].id,   workspaceId: peakWs[0].id,  role: 'OWNER',      joinedAt: daysAgo(30)  },
      { businessId: peak.id,  userId: supervisorUsers[3].id, workspaceId: peakWs[0].id,  role: 'SUPERVISOR', joinedAt: daysAgo(20)  },
    ]});

    // ── 26 Agents ─────────────────────────────────────────────────────────────────
    const agDefs = [
      { e: 'jane@agent.io',    ph: '+254720000001', fi: 'Jane',    la: 'Wanjiru',  city: 'Nairobi',  sk: ['customer-support','chat','email-support'],      ra: 4.8, ta: 143, bi: () => acme.id,  ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 8000  },
      { e: 'peter@agent.io',   ph: '+254720000002', fi: 'Peter',   la: 'Kamau',    city: 'Mombasa',  sk: ['sales','telemarketing','crm'],                  ra: 4.5, ta: 87,  bi: () => acme.id,  ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 7000  },
      { e: 'grace@agent.io',   ph: '+254720000005', fi: 'Grace',   la: 'Njeri',    city: 'Eldoret',  sk: ['customer-support','voice','sales'],             ra: 4.7, ta: 118, bi: () => acme.id,  ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 7500  },
      { e: 'faith@agent.io',   ph: '+254720000007', fi: 'Faith',   la: 'Mutua',    city: 'Thika',    sk: ['chat','email-support','social-media'],          ra: 4.4, ta: 92,  bi: () => acme.id,  ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 6500  },
      { e: 'amina@agent.io',   ph: '+254720000009', fi: 'Amina',   la: 'Hassan',   city: 'Mombasa',  sk: ['kyc-verification','compliance','research'],     ra: 4.8, ta: 167, bi: () => acme.id,  ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 9000  },
      { e: 'ann@agent.io',     ph: '+254720000015', fi: 'Ann',     la: 'Njoroge',  city: 'Nairobi',  sk: ['voice','customer-support','chat'],              ra: 4.9, ta: 212, bi: () => acme.id,  ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 9500  },
      { e: 'felix@agent.io',   ph: '+254720000020', fi: 'Felix',   la: 'Owino',    city: 'Nairobi',  sk: ['kyc-verification','customer-support'],          ra: 0.0, ta: 0,   bi: () => acme.id,  ky: 'PENDING',       st: 'PENDING_VERIFICATION', ty: 'EMPLOYEE',   rt: 6000  },
      { e: 'cynthia@agent.io', ph: '+254720000021', fi: 'Cynthia', la: 'Auma',     city: 'Kisumu',   sk: ['customer-support','email-support'],             ra: 0.0, ta: 0,   bi: () => acme.id,  ky: 'NOT_SUBMITTED', st: 'PENDING_VERIFICATION', ty: 'EMPLOYEE',   rt: 5500  },
      { e: 'samuel@agent.io',  ph: '+254720000006', fi: 'Samuel',  la: 'Otieno',   city: 'Nairobi',  sk: ['data-entry','spreadsheets','finance'],          ra: 4.6, ta: 76,  bi: () => swift.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 8500  },
      { e: 'kevin@agent.io',   ph: '+254720000008', fi: 'Kevin',   la: 'Gitau',    city: 'Nairobi',  sk: ['telemarketing','voice','sales'],                ra: 3.9, ta: 34,  bi: () => swift.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 6000  },
      { e: 'stella@agent.io',  ph: '+254720000017', fi: 'Stella',  la: 'Chebet',   city: 'Kericho',  sk: ['finance','reconciliation','spreadsheets'],      ra: 4.7, ta: 96,  bi: () => swift.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 9000  },
      { e: 'joseph@agent.io',  ph: '+254720000014', fi: 'Joseph',  la: 'Nderitu',  city: 'Nyeri',    sk: ['sales','crm','research'],                      ra: 4.5, ta: 74,  bi: () => swift.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 7500  },
      { e: 'emma@agent.io',    ph: '+254720000022', fi: 'Emma',    la: 'Wekesa',   city: 'Kakamega', sk: ['data-entry','finance'],                        ra: 0.0, ta: 0,   bi: () => swift.id, ky: 'REJECTED',      st: 'SUSPENDED',            ty: 'EMPLOYEE',   rt: 5500  },
      { e: 'dennis@agent.io',  ph: '+254720000023', fi: 'Dennis',  la: 'Baraza',   city: 'Mombasa',  sk: ['customer-support','voice'],                    ra: 4.2, ta: 41,  bi: () => swift.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 6500  },
      { e: 'mary@agent.io',    ph: '+254720000003', fi: 'Mary',    la: 'Akinyi',   city: 'Kisumu',   sk: ['data-entry','research','spreadsheets'],         ra: 4.9, ta: 201, bi: () => nexus.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 8000  },
      { e: 'lucy@agent.io',    ph: '+254720000011', fi: 'Lucy',    la: 'Wambua',   city: 'Kisumu',   sk: ['customer-support','chat','research'],           ra: 4.6, ta: 88,  bi: () => nexus.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 7000  },
      { e: 'charles@agent.io', ph: '+254720000012', fi: 'Charles', la: 'Ouma',     city: 'Kakamega', sk: ['data-entry','excel','research'],                ra: 4.1, ta: 61,  bi: () => nexus.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 6500  },
      { e: 'rose@agent.io',    ph: '+254720000019', fi: 'Rose',    la: 'Adhiambo', city: 'Kisumu',   sk: ['data-entry','research','moderation'],           ra: 4.6, ta: 109, bi: () => nexus.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 7500  },
      { e: 'ian@agent.io',     ph: '+254720000018', fi: 'Ian',     la: 'Macharia', city: 'Nairobi',  sk: ['content','copywriting','research'],             ra: 4.4, ta: 43,  bi: () => nexus.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 8000  },
      { e: 'violet@agent.io',  ph: '+254720000024', fi: 'Violet',  la: 'Maina',    city: 'Nakuru',   sk: ['data-entry','excel'],                          ra: 0.0, ta: 0,   bi: () => nexus.id, ky: 'PENDING',       st: 'PENDING_VERIFICATION', ty: 'EMPLOYEE',   rt: 5500  },
      { e: 'gerald@agent.io',  ph: '+254720000025', fi: 'Gerald',  la: 'Kogo',     city: 'Nairobi',  sk: ['moderation','content','social-media'],          ra: 4.3, ta: 52,  bi: () => nexus.id, ky: 'APPROVED',      st: 'VERIFIED',             ty: 'EMPLOYEE',   rt: 7000  },
      { e: 'daniel@agent.io',  ph: '+254720000004', fi: 'Daniel',  la: 'Mwangi',   city: 'Nakuru',   sk: ['sales','telemarketing','social-media'],         ra: 4.2, ta: 55,  bi: () => peak.id,  ky: 'APPROVED',      st: 'VERIFIED',             ty: 'FREELANCER', rt: 10000 },
      { e: 'diana@agent.io',   ph: '+254720000013', fi: 'Diana',   la: 'Muia',     city: 'Machakos', sk: ['social-media','content','copywriting'],         ra: 4.7, ta: 130, bi: () => null,     ky: 'APPROVED',      st: 'VERIFIED',             ty: 'FREELANCER', rt: 12000 },
      { e: 'benson@agent.io',  ph: '+254720000016', fi: 'Benson',  la: 'Kipchoge', city: 'Eldoret',  sk: ['sales','crm','telemarketing'],                 ra: 4.0, ta: 28,  bi: () => peak.id,  ky: 'APPROVED',      st: 'VERIFIED',             ty: 'FREELANCER', rt: 9000  },
      { e: 'tom@agent.io',     ph: '+254720000010', fi: 'Tom',     la: 'Kariuki',  city: 'Nairobi',  sk: ['research','report-writing','content'],          ra: 4.3, ta: 49,  bi: () => null,     ky: 'NOT_SUBMITTED', st: 'PENDING_VERIFICATION', ty: 'FREELANCER', rt: 8000  },
      { e: 'winnie@agent.io',  ph: '+254720000026', fi: 'Winnie',  la: 'Ochieng',  city: 'Kisumu',   sk: ['sales','voice','customer-support'],             ra: 0.0, ta: 0,   bi: () => peak.id,  ky: 'REJECTED',      st: 'SUSPENDED',            ty: 'FREELANCER', rt: 7500  },
    ];

    const agentUserRecords = await Promise.all(agDefs.map(p => this.prisma.user.create({ data: {
      email: p.e, phone: p.ph, passwordHash: pw,
      firstName: p.fi, lastName: p.la, name: `${p.fi} ${p.la}`,
      role: 'AGENT', status: p.st === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
      emailVerified: true, phoneVerified: p.ky === 'APPROVED',
      lastLoginAt: p.ta > 0 ? daysAgo(rndInt(0, 7)) : undefined,
    }})));

    const agents = await Promise.all(agDefs.map(async (p, i) => {
      const isApproved = p.ky === 'APPROVED';
      const ag = await this.prisma.agent.create({ data: {
        userId: agentUserRecords[i].id,
        businessId: p.bi(),
        status: p.st as any,
        kycStatus: p.ky as any,
        agentType: p.ty as any,
        availability: isApproved && p.ta > 0 ? rnd(['ONLINE','ONLINE','OFFLINE','BUSY','ON_SHIFT']) : 'OFFLINE',
        bio: `${p.sk[0].replace(/-/g,' ')} specialist with ${rndInt(1,8)}+ years experience. Based in ${p.city}, Kenya.`,
        headline: `${p.sk[0].replace(/-/g,' ')} expert | ${p.city}`,
        rating: new Prisma.Decimal(p.ra),
        totalTasks: p.ta, completedTasks: Math.floor(p.ta * 0.92),
        country: 'KE', city: p.city, hourlyRateCents: p.rt, currency: 'KES',
        verifiedAt: isApproved ? daysAgo(rndInt(10, 200)) : undefined,
        skills: { create: p.sk.map((s, si) => ({ skill: s, proficiencyLevel: si === 0 ? 5 : si === 1 ? 4 : 3, yearsOfExperience: rndInt(1, 7) })) },
      }});
      await this.prisma.wallet.create({ data: {
        ownerType: 'AGENT', ownerId: ag.id, userId: agentUserRecords[i].id,
        balanceCents: BigInt(isApproved ? rndInt(2000, 50000) * 100 : 0),
        currency: 'KES', status: p.st === 'SUSPENDED' ? 'FROZEN' : 'ACTIVE',
      }});
      if (isApproved) {
        await this.prisma.agentAvailabilitySlot.createMany({ data: [1,2,3,4,5].map(d => ({
          agentId: ag.id, dayOfWeek: d, startTime: '08:00', endTime: '17:00', timezone: 'Africa/Nairobi',
        }))});
      }
      return ag;
    }));

    const approvedAgents = agents.filter((_, i) => agDefs[i].ky === 'APPROVED');
    const acmeAgents  = agents.slice(0, 6);
    const swiftAgents = agents.slice(8, 14).filter(a => a.kycStatus === 'APPROVED');
    const nexusAgents = agents.slice(14, 21).filter(a => a.kycStatus === 'APPROVED');
    const peakAgents  = [agents[21], agents[23]];

    // ── 100 Tasks ─────────────────────────────────────────────────────────────────
    const tmpls = [
      { t: 'Handle tier-1 support tickets',           c: 'customer-support', sk: ['customer-support','chat'] },
      { t: 'Outbound sales calls — fintech list',     c: 'sales',            sk: ['sales','telemarketing'] },
      { t: 'CRM data entry from spreadsheet',         c: 'data-entry',       sk: ['data-entry','excel'] },
      { t: 'Moderate community forum comments',       c: 'moderation',       sk: ['moderation','social-media'] },
      { t: 'Transcribe customer feedback recordings', c: 'research',         sk: ['research'] },
      { t: 'Email inbox triage and categorisation',   c: 'customer-support', sk: ['email-support','customer-support'] },
      { t: 'KYC document verification batch',         c: 'kyc',              sk: ['kyc-verification','compliance'] },
      { t: 'Social media response queue',             c: 'social-media',     sk: ['social-media','content'] },
      { t: 'Invoice reconciliation run',              c: 'finance',          sk: ['finance','reconciliation'] },
      { t: 'Lead qualification — B2B cold list',      c: 'sales',            sk: ['sales','crm'] },
      { t: 'Product catalogue data entry',            c: 'data-entry',       sk: ['data-entry','spreadsheets'] },
      { t: 'Voice follow-ups — churn cohort',         c: 'sales',            sk: ['voice','telemarketing'] },
      { t: 'Insurance claims data processing',        c: 'data-entry',       sk: ['data-entry','finance'] },
      { t: 'Content moderation — image batch',        c: 'moderation',       sk: ['moderation'] },
      { t: 'Competitive pricing research',            c: 'research',         sk: ['research','report-writing'] },
      { t: 'ML annotation — text classification',     c: 'annotation',       sk: ['data-entry','research'] },
      { t: 'CSAT survey follow-up calls',             c: 'customer-support', sk: ['voice','customer-support'] },
      { t: 'LinkedIn lead scraping and enrichment',   c: 'research',         sk: ['research','crm'] },
      { t: 'Healthcare back-office claims entry',     c: 'data-entry',       sk: ['data-entry','compliance'] },
      { t: 'Copywriting — product landing page',      c: 'content',          sk: ['copywriting','content'] },
    ];
    const taskSts  = ['PENDING','PENDING','ASSIGNED','IN_PROGRESS','IN_PROGRESS','UNDER_REVIEW','COMPLETED','COMPLETED','COMPLETED','FAILED','CANCELLED','ON_HOLD'];
    const allTaskIds: string[] = [];
    const completedTaskIds: string[] = [];

    const bizCfg: Array<[any, any[], any[]]> = [
      [acme,  acmeWs,  acmeAgents],
      [swift, swiftWs, swiftAgents],
      [nexus, nexusWs, nexusAgents],
      [peak,  peakWs,  peakAgents],
    ];

    let tIdx = 0;
    for (const [biz, wsList, bizAgents] of bizCfg) {
      const owner = bizOwnerUsers[businesses.indexOf(biz)];
      for (let i = 0; i < 25; i++) {
        const tmpl     = tmpls[tIdx % tmpls.length];
        const ws       = wsList[i % wsList.length];
        const status   = taskSts[tIdx % taskSts.length] as any;
        const isCmp    = status === 'COMPLETED' || status === 'FAILED';
        const isAct    = status === 'IN_PROGRESS' || status === 'ASSIGNED' || status === 'UNDER_REVIEW';
        const isMkt    = tIdx % 4 === 0;
        const priority = rnd(['LOW','MEDIUM','MEDIUM','HIGH','HIGH','URGENT']) as any;

        const task = await this.prisma.task.create({ data: {
          businessId: biz.id, workspaceId: ws.id, createdById: owner.id,
          title: `${tmpl.t} #${String(tIdx + 1).padStart(3, '0')}`,
          description: `${tmpl.c} task. Follow SOP. SLA: ${rndInt(30, 240)} min. Escalate if blocked >2 hrs.`,
          status, priority, category: tmpl.c, requiredSkills: tmpl.sk,
          budgetCents: rndInt(5, 80) * 1000, currency: 'KES', slaMinutes: rndInt(30, 240),
          dueAt: daysFrom(rndInt(-30, 20)),
          isMarketplace: isMkt, marketplaceStatus: isMkt ? 'APPROVED' : null,
          marketplaceExpiresAt: isMkt ? daysFrom(rndInt(3, 14)) : null, maxBids: isMkt ? 10 : null,
          startedAt: (isAct || isCmp) ? hoursAgo(rndInt(2, 96)) : null,
          completedAt: isCmp ? hoursAgo(rndInt(1, 48)) : null,
          cancelledAt: status === 'CANCELLED' ? hoursAgo(rndInt(1, 72)) : null,
          metadata: { tags: [tmpl.c, priority.toLowerCase()], source: rnd(['internal','marketplace','api']) } as any,
        }});
        allTaskIds.push(task.id);
        if (isCmp) completedTaskIds.push(task.id);

        if ((isAct || isCmp) && bizAgents.length > 0) {
          const agent = bizAgents[tIdx % bizAgents.length];
          await this.prisma.taskAssignment.create({ data: {
            taskId: task.id, agentId: agent.id,
            status: isCmp ? 'COMPLETED' : 'ACCEPTED',
            acceptedAt: hoursAgo(rndInt(5, 100)),
            completedAt: isCmp ? hoursAgo(rndInt(1, 48)) : null,
          }}).catch(() => {});
          await this.prisma.taskHistory.create({ data: {
            taskId: task.id, actorId: owner.id, fromStatus: 'PENDING', toStatus: 'ASSIGNED',
            note: 'Agent assigned', createdAt: hoursAgo(rndInt(50, 120)),
          }});
          if (isCmp) await this.prisma.taskHistory.create({ data: {
            taskId: task.id, actorId: owner.id, fromStatus: 'ASSIGNED', toStatus: 'COMPLETED',
            note: 'Marked complete after QA', createdAt: hoursAgo(rndInt(1, 48)),
          }});
        }
        if (isMkt) {
          const bidCount = rndInt(2, 6);
          for (let b = 0; b < bidCount; b++) {
            const ba = approvedAgents[(tIdx + b) % approvedAgents.length];
            if (!ba) continue;
            const acc = b === 0 && isCmp;
            await this.prisma.bid.create({ data: {
              taskId: task.id, agentId: ba.id,
              proposedCents: rndInt(4, 70) * 1000,
              coverNote: `${rndInt(2,7)}+ years in ${tmpl.c}. QA score 4.5+. Can start immediately.`,
              estimatedDays: rndInt(1, 7),
              status: acc ? 'ACCEPTED' : b % 5 === 0 ? 'REJECTED' : 'PENDING',
              acceptedAt: acc ? hoursAgo(rndInt(5, 60)) : null,
            }}).catch(() => {});
          }
        }
        if ((isCmp || status === 'UNDER_REVIEW') && bizAgents.length > 0) {
          const agent = bizAgents[tIdx % bizAgents.length];
          await this.prisma.taskSubmission.create({ data: {
            taskId: task.id, agentId: agent.id,
            round: 'FINAL', type: 'TEXT',
            content: `Completed ${rndInt(50, 250)} items. Pass rate: ${rndInt(93, 100)}%.`,
            status: isCmp ? 'APPROVED' : 'UNDER_REVIEW',
            reviewNote: isCmp ? 'Approved.' : null,
            reviewedAt: isCmp ? hoursAgo(rndInt(1, 24)) : null,
          }}).catch(() => {});
        }
        tIdx++;
      }
    }

    // ── 40 Shifts ────────────────────────────────────────────────────────────────
    const shiftSts = ['SCHEDULED','SCHEDULED','ACTIVE','COMPLETED','COMPLETED','COMPLETED','MISSED','CANCELLED'];
    for (let i = 0; i < 40; i++) {
      const bizIdx = i % 4;
      const pool   = [acmeAgents, swiftAgents, nexusAgents, peakAgents][bizIdx];
      const agent  = pool[i % pool.length];
      const status = shiftSts[i % shiftSts.length] as any;
      const hOff   = status === 'COMPLETED' ? rndInt(25, 200) : status === 'ACTIVE' ? 2 : -rndInt(2, 48);
      const start  = hoursAgo(hOff);
      const end    = new Date(start.getTime() + rndInt(6, 10) * 3600_000);
      await this.prisma.shift.create({ data: {
        businessId: businesses[bizIdx].id, agentId: agent.id, startAt: start, endAt: end, status,
        notes: status === 'MISSED' ? 'Agent no-show — no prior notice.' : status === 'COMPLETED' ? `Completed ${rndInt(95,100)}% of tasks.` : null,
      }});
    }

    // ── 20 Conversations + messages ──────────────────────────────────────────────
    const msgSets = [
      ['Please start on ticket batch #247 — client SLA is 2 hours.','On it! Updating as I go.','Done — all 42 resolved. Summary sent.'],
      ['I need CRM access for this task.','Credentials sent to your email.','Got them, starting now.'],
      ['Prioritise the KYC batch — 4-hour SLA.','Working on it now.','First 50 done. 3 rejections flagged.','Clear the rest by 5pm.'],
      ['Your last submission had errors in columns C–D.','Correcting now, re-submitting in one hour.','Resubmitted.','Approved.'],
      ['Can we extend task #089 deadline by one day?','Approved. Update the tracker.','Done, thanks!'],
    ];
    for (let i = 0; i < 20; i++) {
      const bizUser   = bizOwnerUsers[i % 4];
      const agentUser = agentUserRecords[i % agentUserRecords.length];
      const taskId    = allTaskIds[i * 5] ?? undefined;
      const bodies    = msgSets[i % msgSets.length];
      const convo = await this.prisma.conversation.create({ data: {
        type: taskId ? 'TASK' : 'DIRECT', taskId, title: `Thread ${i + 1}`,
        participants: { create: [{ userId: bizUser.id }, { userId: agentUser.id }] },
      }});
      for (let m = 0; m < bodies.length; m++) {
        await this.prisma.message.create({ data: {
          conversationId: convo.id, senderId: m % 2 === 0 ? bizUser.id : agentUser.id,
          type: 'TEXT', body: bodies[m], createdAt: hoursAgo(bodies.length - m + rndInt(0, 3)),
        }});
      }
    }

    // ── 130 Wallet transactions (100 agent + 30 business) ─────────────────────
    const txTypes = ['TASK_PAYMENT','TASK_PAYMENT','TASK_PAYMENT','TOPUP','PAYOUT','COMMISSION','FEE'];
    for (let i = 0; i < 100; i++) {
      const w = await this.prisma.wallet.findFirst({ where: { userId: agentUserRecords[i % agentUserRecords.length].id } });
      if (!w || w.status === 'FROZEN') continue;
      const type = txTypes[i % txTypes.length] as any;
      const amt  = BigInt(rndInt(500, 10000) * 100);
      const dago = rndInt(0, 90);
      await this.prisma.walletTransaction.create({ data: {
        walletId: w.id, type, status: 'COMPLETED', amountCents: amt, currency: 'KES',
        reference: `TXN-${uid()}`,
        description: type === 'TASK_PAYMENT' ? `Task payment #${rndInt(100,999)}` : type === 'TOPUP' ? 'M-Pesa top-up' : type === 'PAYOUT' ? 'M-Pesa withdrawal' : 'Platform fee',
        balanceAfterCents: BigInt(rndInt(1000, 80000) * 100),
        completedAt: daysAgo(dago), createdAt: daysAgo(dago),
      }});
    }
    for (let i = 0; i < 30; i++) {
      const bw = await this.prisma.wallet.findFirst({ where: { businessId: businesses[i % 4].id } });
      if (!bw) continue;
      const type = rnd(['CREDIT','DEBIT','FEE']) as any;
      const amt  = BigInt(rndInt(5000, 100000) * 100);
      const dago = rndInt(0, 90);
      await this.prisma.walletTransaction.create({ data: {
        walletId: bw.id, type, status: 'COMPLETED', amountCents: amt, currency: 'KES',
        reference: `BTX-${uid()}`,
        description: type === 'CREDIT' ? 'Bank transfer top-up' : type === 'DEBIT' ? 'Agent payout' : 'Subscription fee',
        balanceAfterCents: BigInt(rndInt(500000, 20000000)),
        completedAt: daysAgo(dago), createdAt: daysAgo(dago),
      }});
    }

    // ── 25 Payouts ────────────────────────────────────────────────────────────────
    const payoutSts = ['PENDING','PROCESSING','COMPLETED','COMPLETED','COMPLETED','FAILED','CANCELLED'];
    let pc = 0;
    for (let i = 0; i < agents.length && pc < 25; i++) {
      const ag = agents[i];
      if (ag.kycStatus !== 'APPROVED') continue;
      const status = payoutSts[pc % payoutSts.length] as any;
      await this.prisma.payout.create({ data: {
        agentId: ag.id, amountCents: BigInt(rndInt(2000, 25000) * 100),
        currency: 'KES', status, method: rnd(['mpesa','mpesa','bank_transfer']),
        destination: `+2547${rndInt(10,99)}${rndInt(100000,999999)}`,
        reference: `PAY-${uid()}`,
        processedAt: status === 'COMPLETED' ? daysAgo(rndInt(1, 30)) : null,
        createdAt: daysAgo(rndInt(1, 60)),
        metadata: { channel: 'M-Pesa' } as any,
      }});
      pc++;
    }

    // ── 24 Invoices ───────────────────────────────────────────────────────────────
    const invSts = ['DRAFT','ISSUED','ISSUED','PAID','PAID','PAID','OVERDUE','CANCELLED'];
    for (let i = 0; i < 24; i++) {
      const biz = businesses[i % 4];
      const amt = BigInt(rndInt(10000, 150000) * 100);
      const tax = amt * 16n / 100n;
      const status = invSts[i % invSts.length] as any;
      const dago = rndInt(5, 90);
      await this.prisma.invoice.create({ data: {
        businessId: biz.id, number: `INV-2026-${String(i + 1).padStart(4, '0')}`,
        amountCents: amt, taxCents: tax, totalCents: amt + tax,
        currency: 'KES', status,
        issuedAt: status !== 'DRAFT' ? daysAgo(dago) : null,
        dueAt: daysFrom(status === 'OVERDUE' ? -rndInt(1, 30) : rndInt(5, 30)),
        paidAt: status === 'PAID' ? daysAgo(rndInt(1, dago)) : null,
        lineItems: [{ description: 'Platform subscription', unitPrice: Number(amt) }] as any,
        metadata: { month: rnd(['January','February','March','April']), year: 2026 } as any,
      }});
    }

    // ── 30 QA Reviews ────────────────────────────────────────────────────────────
    const qaC = ['Excellent quality, professional tone. Recommend for bonus.','Good work, minor formatting issues.','Above SLA. CSAT: 9.4/10.','Solid output. Minor category errors.','Outstanding — 99.2% accuracy, no escalations.','Below expectations — 3 SLA misses.'];
    const reviewers = [...supervisorUsers, adminUser];
    for (let i = 0; i < 30; i++) {
      const taskId   = completedTaskIds[i % Math.max(completedTaskIds.length, 1)] ?? allTaskIds[i % allTaskIds.length];
      const agent    = approvedAgents[i % approvedAgents.length];
      if (!agent) continue;
      const score = rndInt(2, 5);
      await this.prisma.qAReview.create({ data: {
        taskId, agentId: agent.id, reviewerId: reviewers[i % reviewers.length].id,
        score, comment: qaC[i % qaC.length],
        criteria: { accuracy: rndInt(2,5), tone: rndInt(2,5), speed: rndInt(2,5), compliance: rndInt(2,5) } as any,
      }}).catch(() => {});
    }

    // ── 30 Performance metrics ────────────────────────────────────────────────────
    for (let i = 0; i < 30; i++) {
      const agent = approvedAgents[i % approvedAgents.length];
      if (!agent || agent.totalTasks === 0) continue;
      const mo = (i % 3) * 30;
      await this.prisma.performanceMetric.create({ data: {
        agentId: agent.id,
        periodStart: daysAgo(mo + 30), periodEnd: daysAgo(mo),
        tasksCompleted: rndInt(10, 80), tasksFailed: rndInt(0, 5),
        avgRating: new Prisma.Decimal(rndInt(30, 50) / 10),
        avgResponseSec: rndInt(120, 3600), slaBreaches: rndInt(0, 4),
        revenueCents: BigInt(rndInt(5000, 60000) * 100),
      }}).catch(() => {});
    }

    // ── 8 Disputes with messages ──────────────────────────────────────────────────
    const dispDefs = [
      { fb: bizOwnerUsers[0], task: 0, cat: 'PAYMENT',          st: 'OPEN',        pr: 'HIGH',   sub: 'Underpayment — task #001 partial payment only', desc: 'Completed 150 tickets within SLA. Only KES 3,200 released instead of agreed KES 5,000.', msgs: [{ a: 'admin', b: 'Payment released on pro-rated basis. Reviewing full batch logs.' },{ a: 'filer', b: 'QA score 4.8 — full SLA met. Full payment should be released.' },{ a: 'admin', b: 'Confirmed full completion. Additional KES 1,800 approved.' }] },
      { fb: bizOwnerUsers[0], task: 4, cat: 'TASK_QUALITY',     st: 'IN_PROGRESS', pr: 'HIGH',   sub: 'Agent submitted only 40% of required batch',    desc: 'Agent submitted 60 of 150 required items and marked task complete. Quality below 70%.', msgs: [{ a: 'admin', b: 'Agent required to complete remaining 60%.' },{ a: 'filer', b: 'Full file set was not provided on day one.' },{ a: 'admin', b: 'Upload logs confirm full set was available at task creation. Agent must complete.' }] },
      { fb: agentUserRecords[5], task: 9, cat: 'AGENT_CONDUCT', st: 'UNDER_REVIEW',pr: 'URGENT', sub: 'Supervisor messaging outside contracted hours',  desc: 'Supervisor sent work requests 10pm–1am on 17 documented occasions.', msgs: [{ a: 'admin', b: 'HR notified and reviewing communication logs.' },{ a: 'filer', b: 'Screenshots available for all 17 instances.' }] },
      { fb: bizOwnerUsers[1], task: 6, cat: 'PAYMENT',          st: 'RESOLVED',    pr: 'MEDIUM', sub: 'Duplicate charge — INV-2026-0003 and INV-2026-0004', desc: 'Billed twice for March subscription. Both invoices KES 7,999.', resolution: 'Duplicate invoice confirmed. KES 7,999 refunded to business wallet. Billing bug patched.', msgs: [{ a: 'admin', b: 'Confirmed duplicate. Refund of KES 7,999 processed.' },{ a: 'filer', b: 'Refund received. Thank you.' }] },
      { fb: bizOwnerUsers[2], task: 12, cat: 'TASK_QUALITY',    st: 'ESCALATED',   pr: 'URGENT', sub: 'Dataset error rate 8.3% — contract requires <2%', desc: 'Delivered dataset fails internal QA at 8.3% error rate. Contract SLA: <2%. Full re-annotation required at no charge.', msgs: [{ a: 'admin', b: 'Escalated to Enterprise CS. Dedicated reviewer within 24 hours.' },{ a: 'filer', b: 'SLA guarantees 48-hour resolution.' }] },
      { fb: agentUserRecords[3], task: 3, cat: 'BUSINESS_CONDUCT', st: 'OPEN',     pr: 'MEDIUM', sub: 'Task scope changed after acceptance without adjustment', desc: 'Original brief: 50 outbound calls. Changed to 200 calls post-acceptance without budget change.', msgs: [{ a: 'admin', b: 'Reviewing task edit history to verify original scope.' }] },
      { fb: agentUserRecords[6], task: 15, cat: 'PAYMENT',      st: 'IN_PROGRESS', pr: 'HIGH',   sub: 'Payout delayed beyond 48-hour window',           desc: 'Withdrawal of KES 12,500 on April 10 still pending April 15. Ref: PAY-ABC123.', msgs: [{ a: 'admin', b: 'Checking with payments team.' },{ a: 'admin', b: 'Payout flagged by fraud detection — now cleared. Funds in 6 hours.' },{ a: 'filer', b: 'Received. Thank you.' }] },
      { fb: agentUserRecords[1], task: 20, cat: 'OTHER',        st: 'OPEN',        pr: 'MEDIUM', sub: 'Task cancelled after 6 hours work, no compensation', desc: 'Completed 6 hours of work before sudden cancellation. No notification or partial payment.', msgs: [{ a: 'admin', b: 'Task cancelled due to client withdrawal. Reviewing partial compensation eligibility.' }] },
    ];

    for (const d of dispDefs) {
      const taskId  = allTaskIds[d.task % allTaskIds.length];
      const dispute = await this.prisma.dispute.create({ data: {
        filedById: d.fb.id, taskId, category: d.cat as any,
        status: d.st as any, priority: d.pr as any,
        subject: d.sub, description: d.desc,
        resolution: (d as any).resolution ?? null,
        resolvedAt: d.st === 'RESOLVED' ? daysAgo(rndInt(1, 10)) : null,
      }});
      for (let m = 0; m < d.msgs.length; m++) {
        const msg    = d.msgs[m];
        const author = msg.a === 'admin' ? adminUser : d.fb;
        await this.prisma.ticketMessage.create({ data: {
          disputeId: dispute.id, authorId: author.id, body: msg.b,
          createdAt: hoursAgo(d.msgs.length - m + rndInt(0, 4)),
        }});
      }
    }

    // ── 80 Notifications ─────────────────────────────────────────────────────────
    const notifTmpls = [
      { ti: 'New task available',        bo: 'A task matching your skills posted. Budget: KES 4,500.',               ch: 'IN_APP' },
      { ti: 'Task completed ✓',          bo: 'Task marked complete. KES 3,200 being processed to wallet.',           ch: 'IN_APP' },
      { ti: 'Payment received',          bo: 'KES 5,600 added to your WorkStream wallet. Ref: TXN-A89B2C.',          ch: 'PUSH'   },
      { ti: 'New bid on your listing',   bo: 'Ann Njoroge bid KES 7,200 on your marketplace listing.',               ch: 'IN_APP' },
      { ti: 'Shift starting in 30 min', bo: 'Your shift at Acme BPO begins at 08:00. Log in now.',                  ch: 'PUSH'   },
      { ti: 'QA review ready',           bo: 'QA score for April batch ready. Score: 4.7/5.',                        ch: 'IN_APP' },
      { ti: 'KYC approved ✓',            bo: 'Identity verification approved. You can now accept tasks.',            ch: 'EMAIL'  },
      { ti: 'Dispute update',            bo: 'Dispute #DIS-004 updated. Admin has responded — view thread.',         ch: 'IN_APP' },
      { ti: 'Wallet top-up confirmed',   bo: 'KES 10,000 loaded to wallet via M-Pesa.',                             ch: 'PUSH'   },
      { ti: 'New agent joined workspace',bo: 'Felix Owino joined Tier-1 Support and is ready for tasks.',           ch: 'IN_APP' },
      { ti: '⚠ SLA breach alert',        bo: 'Task #057 breached 2-hour SLA. Immediate attention required.',         ch: 'EMAIL'  },
      { ti: 'Subscription renews in 7d', bo: 'Growth plan renews in 7 days. Next invoice: KES 7,999.',              ch: 'EMAIL'  },
      { ti: 'Payout processed',          bo: 'KES 8,500 sent to +254722000001 via M-Pesa. ETA: 5 minutes.',          ch: 'PUSH'   },
      { ti: 'Bid accepted 🎉',           bo: 'Bid on "Lead qualification — B2B cold list" accepted. Start now.',     ch: 'IN_APP' },
      { ti: 'Performance report ready',  bo: 'April report ready. 47 tasks completed. Avg rating: 4.8/5.',           ch: 'EMAIL'  },
      { ti: 'KYC rejected',             bo: 'KYC document rejected. Reason: blurry ID scan. Please resubmit.',      ch: 'EMAIL'  },
      { ti: 'Task assigned to you',      bo: 'Assigned: "Invoice reconciliation run — March". Due in 4 hours.',      ch: 'PUSH'   },
      { ti: 'New message',              bo: 'Alice Munene: "Please start on ticket batch #247 right away."',         ch: 'IN_APP' },
    ];
    const notifTargets = [...agentUserRecords, ...bizOwnerUsers, ...supervisorUsers, adminUser];
    for (let i = 0; i < 80; i++) {
      const user   = notifTargets[i % notifTargets.length];
      const tmpl   = notifTmpls[i % notifTmpls.length];
      const status = rnd(['SENT','SENT','READ','READ','READ','PENDING']) as any;
      await this.prisma.notification.create({ data: {
        userId: user.id, title: tmpl.ti, body: tmpl.bo,
        channel: tmpl.ch as any, status,
        readAt: status === 'READ' ? hoursAgo(rndInt(1, 48)) : null,
        sentAt: status !== 'PENDING' ? hoursAgo(rndInt(1, 72)) : null,
        link: '/dashboard', createdAt: hoursAgo(rndInt(1, 168)),
      }});
    }

    // ── 60 Audit logs ─────────────────────────────────────────────────────────────
    const auditDefs = [
      { ac: 'USER_LOGIN',            en: 'User',        sv: 'INFO'     },
      { ac: 'TASK_CREATED',          en: 'Task',        sv: 'INFO'     },
      { ac: 'TASK_ASSIGNED',         en: 'Task',        sv: 'INFO'     },
      { ac: 'TASK_COMPLETED',        en: 'Task',        sv: 'INFO'     },
      { ac: 'PAYMENT_PROCESSED',     en: 'Payment',     sv: 'INFO'     },
      { ac: 'PAYOUT_INITIATED',      en: 'Payout',      sv: 'INFO'     },
      { ac: 'DISPUTE_OPENED',        en: 'Dispute',     sv: 'WARN'     },
      { ac: 'KYC_APPROVED',          en: 'Agent',       sv: 'INFO'     },
      { ac: 'KYC_REJECTED',          en: 'Agent',       sv: 'WARN'     },
      { ac: 'AGENT_SUSPENDED',       en: 'Agent',       sv: 'WARN'     },
      { ac: 'FEATURE_FLAG_TOGGLED',  en: 'FeatureFlag', sv: 'WARN'     },
      { ac: 'SUBSCRIPTION_UPGRADED', en: 'Business',    sv: 'INFO'     },
      { ac: 'INVOICE_ISSUED',        en: 'Invoice',     sv: 'INFO'     },
      { ac: 'ADMIN_OVERRIDE',        en: 'Task',        sv: 'CRITICAL' },
      { ac: 'DISPUTE_RESOLVED',      en: 'Dispute',     sv: 'INFO'     },
    ];
    const auditActors = [...bizOwnerUsers, ...agentUserRecords.slice(0, 6), adminUser];
    for (let i = 0; i < 60; i++) {
      const def   = auditDefs[i % auditDefs.length];
      const actor = auditActors[i % auditActors.length];
      await this.prisma.auditLog.create({ data: {
        actorId: actor.id, entityType: def.en, entityId: allTaskIds[i % allTaskIds.length] ?? actor.id,
        action: def.ac, severity: def.sv as any,
        ipAddress: `41.${rndInt(200,250)}.${rndInt(1,255)}.${rndInt(1,255)}`,
        userAgent: rnd(['Mozilla/5.0 (Windows NT 10.0)','Mozilla/5.0 (iPhone)','WorkStream-Flutter/2.4']),
        metadata: { source: rnd(['web','mobile','api']) } as any,
        createdAt: daysAgo(rndInt(0, 90)),
      }});
    }

    // ── Feature flags + settings ─────────────────────────────────────────────────
    await this.prisma.featureFlag.createMany({ data: [
      { key: 'voice-calls',           enabled: true,  rolloutPct: 100, description: 'In-app voice calls between agents and businesses' },
      { key: 'video-calls',           enabled: false, rolloutPct: 0,   description: 'In-app video calls — beta' },
      { key: 'ai-task-routing',       enabled: false, rolloutPct: 0,   description: 'AI-powered agent matching' },
      { key: 'auto-qa-scoring',       enabled: false, rolloutPct: 10,  description: 'Automated QA scoring via LLM (10% beta)' },
      { key: 'marketplace-bidding',   enabled: true,  rolloutPct: 100, description: 'Verified agents bid on marketplace tasks' },
      { key: 'wallet-payouts',        enabled: true,  rolloutPct: 100, description: 'M-Pesa wallet withdrawals for agents' },
      { key: 'shift-scheduler',       enabled: true,  rolloutPct: 100, description: 'Shift scheduling module' },
      { key: 'performance-dashboard', enabled: true,  rolloutPct: 100, description: 'Agent performance analytics' },
      { key: 'bulk-task-import',      enabled: false, rolloutPct: 0,   description: 'CSV bulk task import (enterprise)' },
      { key: 'sla-alerts',            enabled: true,  rolloutPct: 100, description: 'Real-time SLA breach notifications' },
      { key: 'multi-workspace',       enabled: true,  rolloutPct: 100, description: 'Multiple workspaces per business' },
      { key: 'api-access',            enabled: false, rolloutPct: 0,   description: 'REST API keys for enterprise' },
    ]});

    await this.prisma.systemSetting.createMany({ data: [
      { key: 'pricing.platform_fee_pct',      value: 10 as any,                    category: 'pricing'       },
      { key: 'pricing.min_payout_amount',     value: 1000 as any,                  category: 'pricing'       },
      { key: 'pricing.max_payout_amount',     value: 500000 as any,                category: 'pricing'       },
      { key: 'pricing.payout_currencies',     value: ['KES','USD','EUR'] as any,   category: 'pricing'       },
      { key: 'sla.dispute_hours',             value: 48 as any,                    category: 'sla'           },
      { key: 'sla.support_hours',             value: 24 as any,                    category: 'sla'           },
      { key: 'sla.kyc_hours',                 value: 12 as any,                    category: 'sla'           },
      { key: 'sla.task_assignment_hours',     value: 4 as any,                     category: 'sla'           },
      { key: 'notifications.emailEnabled',    value: true as any,                  category: 'notifications' },
      { key: 'notifications.smsEnabled',      value: true as any,                  category: 'notifications' },
      { key: 'notifications.pushEnabled',     value: true as any,                  category: 'notifications' },
      { key: 'security.sessionTimeoutMins',   value: 60 as any,                    category: 'security'      },
      { key: 'security.maxLoginAttempts',     value: 5 as any,                     category: 'security'      },
      { key: 'security.mfaRequired',          value: false as any,                 category: 'security'      },
      { key: 'payments.mpesaShortcode',       value: '898980' as any,              category: 'integrations'  },
      { key: 'payments.mpesaConsumerKey',     value: 'mpesa-ck-placeholder' as any, category: 'integrations' },
      { key: 'payments.brevoApiKey',          value: 'brevo-placeholder' as any,   category: 'integrations'  },
      { key: 'platform.appVersion',           value: '2.4.1' as any,               category: 'platform'      },
      { key: 'platform.maintenanceMode',      value: false as any,                 category: 'platform'      },
      { key: 'platform.maxAgentsPerBusiness', value: 100 as any,                   category: 'platform'      },
    ]});

    return {
      seeded: true,
      summary: {
        businesses: 4, workspaces: 13, agents: 26, tasks: 100,
        shifts: 40, conversations: 20, walletTxns: 130, payouts: 25,
        invoices: 24, qaReviews: 30, perfMetrics: 30, disputes: 8,
        notifications: 80, auditLogs: 60, featureFlags: 12, settings: 20,
      },
      credentials: {
        password: 'Password123!',
        accounts: [
          'admin@workstream.io — ADMIN',
          'alice@acmebpo.co.ke — BUSINESS (Acme BPO, Growth plan)',
          'david@swiftops.co.ke — BUSINESS (SwiftOps, Starter plan)',
          'priya@nexusdata.co.ke — BUSINESS (Nexus Data, Enterprise plan)',
          'kofi@peaksales.africa — BUSINESS (PeakSales, Free plan)',
          'brian@acmebpo.co.ke — SUPERVISOR',
          'ann@agent.io — AGENT (4.9★, 212 tasks, top performer)',
          'mary@agent.io — AGENT (4.9★, 201 tasks)',
          'felix@agent.io — AGENT (KYC PENDING — for KYC queue)',
          'emma@agent.io — AGENT (KYC REJECTED + SUSPENDED)',
          'benjaminkakaimasai@gmail.com — BUSINESS (co-owner Acme)',
        ],
      },
    };
  }
}
