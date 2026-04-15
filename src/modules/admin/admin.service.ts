import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MailService } from '../notifications/mail.service';
import { SmsService } from '../notifications/sms.service';
import {
  AdminCreateBusinessDto,
  AdminCreateUserDto,
  FileDisputeDto,
  AddTicketMessageDto,
  ListAuditLogsDto,
  ListDisputesDto,
  ResolveDisputeDto,
  UpsertFeatureFlagDto,
  UpsertSettingDto,
  ReviewKycDto,
} from './dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  // ---- Users (admin) ----
  async listUsers(query: PaginationDto & { role?: string; status?: string; search?: string }) {
    const { skip, limit, page } = pageParams(query);
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, phone: true, firstName: true, lastName: true, name: true, role: true, status: true, emailVerified: true, createdAt: true, lastLoginAt: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { agentProfile: { include: { skills: true } }, businessMembers: { include: { business: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Remove FK-dependent records first
    await this.prisma.task.deleteMany({ where: { createdById: id } });
    await this.prisma.agent.deleteMany({ where: { userId: id } });
    await this.prisma.userSession.deleteMany({ where: { userId: id } });
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: id } });
    await this.prisma.notification.deleteMany({ where: { userId: id } });
    const wallets = await this.prisma.wallet.findMany({ where: { userId: id }, select: { id: true } });
    if (wallets.length) {
      await this.prisma.walletTransaction.deleteMany({
        where: { walletId: { in: wallets.map((w) => w.id) } },
      });
      await this.prisma.wallet.deleteMany({ where: { userId: id } });
    }
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }

  async updateUserStatus(id: string, status: string, actorId?: string) {
    const updated = await this.prisma.user.update({ where: { id }, data: { status: status as any } });
    await this.record(actorId ?? null, 'User', id, 'USER_STATUS_UPDATED', { newStatus: status }).catch(() => {});
    return updated;
  }

  // ---- Create user (admin invite) ----
  async createUser(dto: AdminCreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email.toLowerCase() }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
    });
    if (existing) throw new ConflictException('Email or phone already registered');

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : await bcrypt.hash(Math.random().toString(36).slice(2) + Date.now(), 10);

    const role = dto.role ?? 'BUSINESS';
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role,
        name: [dto.firstName, dto.lastName].filter(Boolean).join(' ') || dto.email.split('@')[0],
        status: 'ACTIVE',
      },
    });

    // If AGENT role — auto-create agent profile
    if (role === 'AGENT') {
      await this.prisma.agent.create({
        data: {
          userId: user.id,
          country: dto.country,
          city: dto.city,
          bio: dto.bio,
          ...(dto.skills?.length ? {
            skills: { create: dto.skills.map((skill) => ({ skill })) },
          } : {}),
        },
      });
    }

    // If BUSINESS role and businessName provided — auto-create business record
    if (role === 'BUSINESS' && dto.businessName) {
      const slug = (dto.businessName ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
      const biz = await this.prisma.business.create({
        data: {
          name: dto.businessName,
          slug,
          contactEmail: dto.email.toLowerCase(),
          contactPhone: dto.businessPhone ?? dto.phone,
          industry: dto.businessIndustry,
          website: dto.businessWebsite,
          description: dto.businessDescription,
          status: 'PENDING_VERIFICATION',
        },
      });
      await this.prisma.businessMember.create({
        data: { businessId: biz.id, userId: user.id, role: 'OWNER' },
      });
    }

    // Org linking — SUPERVISOR/ADMIN (required), AGENT (optional)
    if (dto.businessId && (role === 'SUPERVISOR' || role === 'ADMIN' || role === 'AGENT')) {
      const memberRole = role === 'SUPERVISOR' ? 'SUPERVISOR' : role === 'ADMIN' ? 'MANAGER' : 'MEMBER';
      await this.prisma.businessMember.create({
        data: { businessId: dto.businessId, userId: user.id, role: memberRole as any },
      });
    }

    await this.record(null, 'User', user.id, 'ADMIN_USER_CREATED', { email: user.email, role: user.role }).catch(() => {});
    return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, phone: user.phone ?? null, firstName: user.firstName ?? null, lastName: user.lastName ?? null, createdAt: user.createdAt };
  }

  // ---- Create business (standalone) ----
  async createBusiness(dto: AdminCreateBusinessDto) {
    const email = dto.contactEmail.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('A user with this email already exists');
    const existingBiz = await this.prisma.business.findFirst({ where: { contactEmail: email } });
    if (existingBiz) throw new ConflictException('A business with this email already exists');

    const tempPassword = dto.password?.trim() || `Ws${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 4).toUpperCase()}@1`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const fullName = [dto.ownerFirstName, dto.ownerLastName].filter(Boolean).join(' ');
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.ownerFirstName,
          lastName: dto.ownerLastName ?? null,
          name: fullName || dto.ownerFirstName,
          phone: dto.contactPhone ?? null,
          role: 'BUSINESS',
        },
      });
      const biz = await tx.business.create({
        data: {
          name: dto.name,
          slug,
          contactEmail: email,
          contactPhone: dto.contactPhone ?? null,
          industry: dto.industry ?? null,
          website: dto.website ?? null,
          description: dto.description ?? null,
          status: 'PENDING_VERIFICATION',
        },
      });
      await tx.businessMember.create({
        data: { businessId: biz.id, userId: user.id, role: 'OWNER', joinedAt: new Date() },
      });
      await tx.wallet.create({
        data: { ownerType: 'BUSINESS', ownerId: biz.id, businessId: biz.id },
      });
      return { biz, userId: user.id };
    });

    const appUrl = process.env.APP_URL ?? 'http://localhost:3200';
    await this.mail.send({
      to: email,
      subject: `Your Workstream business account — ${dto.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#7c3aed">Welcome to Workstream</h2>
          <p>Hi ${fullName || dto.ownerFirstName}, your business <strong>${dto.name}</strong> has been set up. Use the credentials below to log in:</p>
          <table style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;width:100%">
            <tr><td style="color:#6b7280;padding:4px 0">Login URL</td><td><a href="${appUrl}">${appUrl}</a></td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Email</td><td>${email}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Temp password</td><td style="font-family:monospace;font-weight:bold">${tempPassword}</td></tr>
          </table>
          <p style="color:#ef4444;font-size:13px">Please change your password after your first login.</p>
        </div>
      `,
      text: `Welcome to Workstream.\nBusiness: ${dto.name}\nLogin: ${appUrl}\nEmail: ${email}\nTemp password: ${tempPassword}\n\nPlease change your password after first login.`,
    }).catch(() => { /* non-fatal */ });

    if (dto.contactPhone) {
      const phone = dto.contactPhone.replace(/\D/g, '');
      await this.sms.send({
        to: phone,
        message: `Workstream: Hi ${dto.ownerFirstName}, your business "${dto.name}" is ready. Login at ${appUrl} | Email: ${email} | Password: ${tempPassword} | Change password on first login.`,
      }).catch(() => { /* non-fatal */ });
    }

    return {
      ...result.biz,
      email: result.biz.contactEmail,
      phone: result.biz.contactPhone,
      ownerName: fullName,
      ownerId: result.userId,
      tempPassword,
    };
  }

  async resetBusinessOwnerPassword(businessId: string, newPassword: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { members: { where: { role: 'OWNER' }, include: { user: true }, take: 1 } },
    });
    if (!biz) throw new NotFoundException('Business not found');
    const owner = (biz as any).members?.[0]?.user;
    if (!owner) throw new NotFoundException('Business owner account not found');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: owner.id }, data: { passwordHash } });

    const appUrl = process.env.APP_URL ?? 'http://localhost:3200';
    const name = owner.name ?? owner.firstName ?? owner.email;

    await this.mail.send({
      to: owner.email,
      subject: `Your Workstream password has been reset — ${biz.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#7c3aed">Password reset</h2>
          <p>Hi ${name}, your Workstream password for <strong>${biz.name}</strong> has been reset by an admin.</p>
          <table style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;width:100%">
            <tr><td style="color:#6b7280;padding:4px 0">Login URL</td><td><a href="${appUrl}">${appUrl}</a></td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Email</td><td>${owner.email}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">New password</td><td style="font-family:monospace;font-weight:bold">${newPassword}</td></tr>
          </table>
          <p style="color:#ef4444;font-size:13px">Please change your password after logging in.</p>
        </div>
      `,
      text: `Your Workstream password has been reset.\nLogin: ${appUrl}\nEmail: ${owner.email}\nNew password: ${newPassword}\n\nPlease change it after login.`,
    }).catch(() => {});

    if (owner.phone) {
      await this.sms.send({
        to: owner.phone.replace(/\D/g, ''),
        message: `Workstream: Hi ${name}, your password for "${biz.name}" was reset. Login: ${appUrl} | Email: ${owner.email} | New password: ${newPassword}`,
      }).catch(() => {});
    }

    return { success: true };
  }

  // ---- Delete feature flag ----
  async deleteFlag(key: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return this.prisma.featureFlag.delete({ where: { key } });
  }

  // ---- Disputes / Tickets ----
  private disputeInclude = {
    filedBy: { select: { id: true, email: true, name: true, firstName: true, lastName: true, role: true } },
    task: { select: { id: true, title: true } },
    assignedToAgent: { select: { id: true, user: { select: { name: true, email: true } } } },
    assignedToBusiness: { select: { id: true, name: true } },
    messages: {
      orderBy: { createdAt: 'asc' as const },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    },
  };

  private shapeDispute(d: any) {
    return {
      ...d,
      requesterName: d.filedBy?.name ?? (`${d.filedBy?.firstName ?? ''} ${d.filedBy?.lastName ?? ''}`.trim() || d.filedBy?.email),
      requesterEmail: d.filedBy?.email,
      requesterRole: d.filedBy?.role,
      assigneeName: d.assignedToAgent?.user?.name ?? d.assignedToAgent?.user?.email ?? d.assignedToBusiness?.name ?? null,
      messages: (d.messages ?? []).map((m: any) => ({
        id: m.id,
        authorId: m.authorId,
        authorName: m.author?.name ?? m.author?.email,
        authorRole: m.author?.role,
        body: m.body,
        internal: m.internal,
        createdAt: m.createdAt,
      })),
    };
  }

  async fileDispute(filedById: string, dto: FileDisputeDto) {
    const d = await this.prisma.dispute.create({
      data: {
        filedById,
        taskId: dto.taskId ?? null,
        category: dto.category,
        priority: dto.priority ?? 'MEDIUM',
        assigneeType: dto.assigneeType ?? 'ADMIN',
        assignedToAgentId: dto.assignedToAgentId ?? null,
        assignedToBusinessId: dto.assignedToBusinessId ?? null,
        subject: dto.subject,
        description: dto.description,
      },
      include: this.disputeInclude,
    });
    return this.shapeDispute(d);
  }

  async listDisputes(dto: ListDisputesDto) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {};
    if (dto.status) where.status = dto.status;
    if (dto.agentId) where.assignedToAgentId = dto.agentId;
    if (dto.businessId) where.assignedToBusinessId = dto.businessId;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.disputeInclude,
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items: items.map(d => this.shapeDispute(d)), total, page, limit };
  }

  async getDispute(id: string) {
    const d = await this.prisma.dispute.findUnique({ where: { id }, include: this.disputeInclude });
    if (!d) throw new NotFoundException('Ticket not found');
    return this.shapeDispute(d);
  }

  async resolveDispute(id: string, dto: ResolveDisputeDto, actorId?: string) {
    const d = await this.prisma.dispute.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dispute not found');
    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.priority) data.priority = dto.priority;
    if (dto.resolution !== undefined) data.resolution = dto.resolution;
    if (dto.assigneeType) data.assigneeType = dto.assigneeType;
    if (dto.assignedToAgentId !== undefined) data.assignedToAgentId = dto.assignedToAgentId || null;
    if (dto.assignedToBusinessId !== undefined) data.assignedToBusinessId = dto.assignedToBusinessId || null;
    if (dto.status === 'RESOLVED' || dto.status === 'REJECTED' || dto.status === 'CLOSED') {
      data.resolvedAt = new Date();
    }
    const updated = await this.prisma.dispute.update({ where: { id }, data, include: this.disputeInclude });
    await this.record(actorId ?? null, 'Dispute', id, `DISPUTE_${dto.status ?? 'UPDATED'}`, {}).catch(() => {});
    return this.shapeDispute(updated);
  }

  async addTicketMessage(disputeId: string, authorId: string, dto: AddTicketMessageDto) {
    const d = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!d) throw new NotFoundException('Ticket not found');
    // Auto-progress to IN_PROGRESS on first reply if still OPEN
    if (d.status === 'OPEN') {
      await this.prisma.dispute.update({ where: { id: disputeId }, data: { status: 'IN_PROGRESS' } });
    }
    const msg = await this.prisma.ticketMessage.create({
      data: { disputeId, authorId, body: dto.body, internal: dto.internal ?? false },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    });
    return {
      id: msg.id,
      authorId: msg.authorId,
      authorName: (msg as any).author?.name ?? (msg as any).author?.email,
      authorRole: (msg as any).author?.role,
      body: msg.body,
      internal: msg.internal,
      createdAt: msg.createdAt,
    };
  }

  async listTicketMessages(disputeId: string) {
    const msgs = await this.prisma.ticketMessage.findMany({
      where: { disputeId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    });
    return msgs.map((m: any) => ({
      id: m.id,
      authorId: m.authorId,
      authorName: m.author?.name ?? m.author?.email,
      authorRole: m.author?.role,
      body: m.body,
      internal: m.internal,
      createdAt: m.createdAt,
    }));
  }

  // ---- Audit logs ----
  async listAuditLogs(dto: ListAuditLogsDto & { actorId?: string; userId?: string; resource?: string; resourceId?: string }) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {};
    if (dto.entityType) where.entityType = dto.entityType;
    if (dto.entityId) where.entityId = dto.entityId;
    if (dto.resource) where.entityType = dto.resource;  // frontend uses 'resource'
    if (dto.resourceId) where.entityId = dto.resourceId;
    if (dto.action) where.action = { contains: dto.action, mode: 'insensitive' };
    if (dto.severity) where.severity = dto.severity;
    const actorFilter = dto.actorId ?? dto.userId;
    if (actorFilter) where.actorId = actorFilter;

    const [raw, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items = raw.map((log) => ({
      id: log.id,
      actorId: log.actorId ?? null,
      actorEmail: (log as any).actor?.email ?? null,
      actorName: (log as any).actor?.name ?? null,
      // Aliases for frontend compatibility
      userId: log.actorId ?? null,
      userEmail: (log as any).actor?.email ?? null,
      action: log.action,
      resource: log.entityType,
      resourceId: log.entityId ?? null,
      // Legacy aliases
      entityType: log.entityType,
      entityId: log.entityId ?? null,
      severity: log.severity,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    return { items, total, page, limit };
  }

  async record(
    actorId: string | null,
    entityType: string,
    entityId: string | null,
    action: string,
    metadata?: any,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId: actorId ?? undefined,
        entityType,
        entityId: entityId ?? undefined,
        action,
        metadata,
      },
    });
  }

  // ---- Settings ----
  async listSettings() {
    return this.prisma.systemSetting.findMany({
      orderBy: { category: 'asc' },
    });
  }

  async upsertSetting(dto: UpsertSettingDto) {
    return this.prisma.systemSetting.upsert({
      where: { key: dto.key },
      create: { key: dto.key, value: dto.value, category: dto.category },
      update: { value: dto.value, category: dto.category },
    });
  }

  // ---- Feature flags ----
  async listFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertFlag(dto: UpsertFeatureFlagDto) {
    return this.prisma.featureFlag.upsert({
      where: { key: dto.key },
      create: dto,
      update: dto,
    });
  }

  // ---- KYC review ----
  async reviewKyc(agentId: string, reviewerId: string, dto: ReviewKycDto) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { user: true },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const agentData: any = { kycStatus: dto.status };
    if (dto.status === 'APPROVED') {
      agentData.status = 'VERIFIED';
      agentData.verifiedAt = new Date();
    }

    const updated = await this.prisma.agent.update({
      where: { id: agentId },
      data: agentData,
    });

    // Notify the agent's user
    await this.prisma.notification.create({
      data: {
        userId: agent.userId,
        title: `KYC ${dto.status}`,
        body:
          dto.status === 'APPROVED'
            ? 'Your KYC has been approved. You can now accept tasks.'
            : `Your KYC was rejected. ${dto.note ?? ''}`,
        channel: 'IN_APP',
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // Audit log
    await this.record(reviewerId, 'Agent', agentId, `KYC_${dto.status}`, {
      note: dto.note,
    });

    return updated;
  }
}
