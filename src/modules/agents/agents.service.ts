import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import {
  AddAvailabilitySlotDto,
  AddSkillDto,
  CreateAgentDto,
  InviteAgentDto,
  ListAgentsDto,
  SetAvailabilityDto,
  UpdateAgentDto,
  UpdateAgentStatusDto,
  UpdateKycDto,
} from './dto';
import { MailService } from '../notifications/mail.service';
import { SmsService } from '../notifications/sms.service';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  async create(dto: CreateAgentDto) {
    const existing = await this.prisma.agent.findUnique({
      where: { userId: dto.userId },
    });
    if (existing) throw new ConflictException('Agent profile already exists');

    return this.prisma.$transaction(async (tx) => {
      const agent = await tx.agent.create({ data: { ...dto } });
      await tx.wallet.create({
        data: {
          ownerType: 'AGENT',
          ownerId: agent.id,
          userId: dto.userId,
        },
      });
      await tx.user.update({
        where: { id: dto.userId },
        data: { role: 'AGENT' },
      });
      return agent;
    });
  }

  async list(dto: ListAgentsDto) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {};
    if (dto.status) where.status = dto.status;
    if (dto.availability) where.availability = dto.availability;
    if (dto.businessId) where.businessId = dto.businessId;
    if (dto.skills?.length) {
      where.skills = { some: { skill: { in: dto.skills } } };
    }
    const [raw, total] = await this.prisma.$transaction([
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { rating: 'desc' },
        include: {
          user: { select: { id: true, email: true, name: true, firstName: true, lastName: true, phone: true } },
          skills: true,
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    const items = raw.map((a) => ({
      ...a,
      fullName: (a as any).user?.name ?? [(a as any).user?.firstName, (a as any).user?.lastName].filter(Boolean).join(' ') ?? (a as any).user?.email ?? '',
      email: (a as any).user?.email ?? '',
      phone: (a as any).user?.phone ?? null,
    }));

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const a = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
        skills: true,
        availabilitySlots: true,
      },
    });
    if (!a) throw new NotFoundException('Agent not found');
    return a;
  }

  async update(id: string, dto: UpdateAgentDto) {
    await this.assertExists(id);
    return this.prisma.agent.update({ where: { id }, data: dto });
  }

  async setAvailability(id: string, dto: SetAvailabilityDto) {
    await this.assertExists(id);
    return this.prisma.agent.update({
      where: { id },
      data: { availability: dto.availability },
    });
  }

  async updateStatus(id: string, dto: UpdateAgentStatusDto) {
    await this.assertExists(id);
    const data: any = { status: dto.status };
    if (dto.status === 'VERIFIED') data.verifiedAt = new Date();
    return this.prisma.agent.update({ where: { id }, data });
  }

  async updateKyc(id: string, dto: UpdateKycDto) {
    await this.assertExists(id);
    return this.prisma.agent.update({
      where: { id },
      data: { kycStatus: dto.kycStatus },
    });
  }

  // Skills
  async addSkill(agentId: string, dto: AddSkillDto) {
    await this.assertExists(agentId);
    return this.prisma.agentSkill.upsert({
      where: { agentId_skill: { agentId, skill: dto.skill } },
      create: { agentId, ...dto },
      update: {
        proficiencyLevel: dto.proficiencyLevel,
        yearsOfExperience: dto.yearsOfExperience,
      },
    });
  }

  async removeSkill(skillId: string) {
    const s = await this.prisma.agentSkill.findUnique({
      where: { id: skillId },
    });
    if (!s) throw new NotFoundException('Skill not found');
    await this.prisma.agentSkill.delete({ where: { id: skillId } });
    return { success: true };
  }

  // Availability slots
  async addSlot(agentId: string, dto: AddAvailabilitySlotDto) {
    await this.assertExists(agentId);
    return this.prisma.agentAvailabilitySlot.create({
      data: { agentId, ...dto },
    });
  }

  async removeSlot(slotId: string) {
    const s = await this.prisma.agentAvailabilitySlot.findUnique({
      where: { id: slotId },
    });
    if (!s) throw new NotFoundException('Slot not found');
    await this.prisma.agentAvailabilitySlot.delete({ where: { id: slotId } });
    return { success: true };
  }

  async invite(dto: InviteAgentDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already registered');

    // Generate a secure temp password
    const tempPassword = `Ws${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 4).toUpperCase()}@1`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const fullName = [dto.firstName, dto.lastName].filter(Boolean).join(' ') || undefined;

    const agent = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          name: fullName,
          role: 'AGENT',
        },
      });
      const ag = await tx.agent.create({
        data: {
          userId: user.id,
          businessId: dto.businessId,
          hourlyRateCents: dto.hourlyRateCents,
          agentType: dto.agentType ?? 'FREELANCER',
        },
        include: { user: { select: { id: true, email: true, name: true, firstName: true, lastName: true } } },
      });
      await tx.wallet.create({
        data: { ownerType: 'AGENT', ownerId: ag.id, userId: user.id },
      });
      if (dto.skills?.length) {
        await tx.agentSkill.createMany({
          data: dto.skills.map((skill) => ({ agentId: ag.id, skill })),
          skipDuplicates: true,
        });
      }
      return {
        ...ag,
        fullName: (ag as any).user?.name ?? fullName ?? dto.email,
        email: (ag as any).user?.email ?? dto.email,
      };
    });

    const appUrl = process.env.APP_URL ?? 'http://localhost:3200';
    const name = fullName ?? dto.email;

    // Send email
    await this.mail.send({
      to: dto.email,
      subject: "You've been invited to join Workstream",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#7c3aed">Welcome to Workstream${dto.personalMessage ? '' : '!'}</h2>
          ${dto.personalMessage ? `<p>${dto.personalMessage}</p>` : ''}
          <p>Hi ${name}, your agent account has been created. Here are your login details:</p>
          <table style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;width:100%">
            <tr><td style="color:#6b7280;padding:4px 0">Login URL</td><td><a href="${appUrl}">${appUrl}</a></td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Email</td><td>${dto.email}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Temp password</td><td style="font-family:monospace;font-weight:bold">${tempPassword}</td></tr>
          </table>
          <p style="color:#ef4444;font-size:13px">Please change your password after your first login.</p>
        </div>
      `,
      text: `You've been invited to Workstream.\nLogin: ${appUrl}\nEmail: ${dto.email}\nTemp password: ${tempPassword}\n\nPlease change your password after first login.`,
    });

    // Send SMS if phone provided
    if (dto.phone) {
      await this.sms.send({
        to: dto.phone.replace(/\D/g, ''),
        message: `Workstream invite: login at ${appUrl} | Email: ${dto.email} | Temp pass: ${tempPassword} | Change password on first login.`,
      });
    }

    return agent;
  }

  async getPerformance(agentId: string) {
    await this.assertExists(agentId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [assignments, last30] = await this.prisma.$transaction([
      this.prisma.taskAssignment.findMany({
        where: { agentId },
        select: { status: true, assignedAt: true, completedAt: true, acceptedAt: true },
      }),
      this.prisma.taskAssignment.count({
        where: { agentId, assignedAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const total = assignments.length;
    const completed = assignments.filter((a) => a.status === 'COMPLETED').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // On-time: completed before/at acceptedAt + some SLA (fallback: if completedAt exists = on-time)
    const onTime = assignments.filter((a) => a.status === 'COMPLETED' && a.completedAt).length;
    const onTimeRate = completed > 0 ? Math.round((onTime / completed) * 100) : 0;

    // Avg response: minutes between assignedAt and acceptedAt
    const responseTimes = assignments
      .filter((a) => a.acceptedAt)
      .map((a) => Math.round((a.acceptedAt!.getTime() - a.assignedAt.getTime()) / 60000));
    const avgResponseMins =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length)
        : 0;

    return { completionRate, onTimeRate, avgResponseMins, last30Tasks: last30 };
  }

  async getEarnings(agentId: string) {
    await this.assertExists(agentId);
    const wallet = await this.prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: 'AGENT', ownerId: agentId } },
    });

    if (!wallet) {
      return { totalEarnings: 0, pendingPayout: 0, lastPayout: undefined, history: [] };
    }

    const [payouts, pendingPayouts] = await this.prisma.$transaction([
      this.prisma.payout.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.payout.aggregate({
        where: { agentId, status: 'PENDING' },
        _sum: { amountCents: true },
      }),
    ]);

    const totalEarnings = Number(wallet.balanceCents) / 100;
    const pendingPayout = Number(pendingPayouts._sum.amountCents ?? 0) / 100;
    const lastPayout = payouts.find((p) => p.status === 'COMPLETED')?.processedAt?.toISOString();

    const history = payouts.map((p) => ({
      id: p.id,
      amount: Number(p.amountCents) / 100,
      at: p.createdAt.toISOString(),
      status: p.status,
    }));

    return { totalEarnings, pendingPayout, lastPayout, history };
  }

  async getRatingDistribution(agentId: string): Promise<Record<number, number>> {
    await this.assertExists(agentId);
    const reviews = await this.prisma.qAReview.findMany({
      where: { agentId },
      select: { score: true },
    });
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      if (r.score >= 1 && r.score <= 5) dist[r.score] = (dist[r.score] ?? 0) + 1;
    }
    return dist;
  }

  async getDisputes(agentId: string) {
    await this.assertExists(agentId);
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true },
    });
    const disputes = await this.prisma.dispute.findMany({
      where: { filedById: agent!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, subject: true, status: true, createdAt: true, category: true },
    });
    const items = disputes.map((d) => ({
      id: d.id,
      reason: `[${d.category}] ${d.subject}`,
      status: d.status,
      at: d.createdAt.toISOString(),
    }));
    return { items };
  }

  async getTasks(agentId: string) {
    await this.assertExists(agentId);
    const assignments = await this.prisma.taskAssignment.findMany({
      where: { agentId },
      orderBy: { assignedAt: 'desc' },
      take: 50,
      include: {
        task: { select: { id: true, title: true, status: true, budgetCents: true, currency: true, createdAt: true } },
      },
    });
    const items = assignments.map((a) => ({
      id: a.task.id,
      title: a.task.title,
      status: a.task.status,
      budget: a.task.budgetCents ? Number(a.task.budgetCents) / 100 : undefined,
      at: a.task.createdAt.toISOString(),
    }));
    return { items };
  }

  private async assertExists(id: string) {
    const a = await this.prisma.agent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!a) throw new NotFoundException('Agent not found');
  }
}
