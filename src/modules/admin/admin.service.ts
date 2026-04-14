import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  FileDisputeDto,
  ListAuditLogsDto,
  ListDisputesDto,
  ResolveDisputeDto,
  UpsertFeatureFlagDto,
  UpsertSettingDto,
  ReviewKycDto,
} from './dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

  async updateUserStatus(id: string, status: string) {
    return this.prisma.user.update({ where: { id }, data: { status: status as any } });
  }

  // ---- Disputes ----
  async fileDispute(filedById: string, dto: FileDisputeDto) {
    return this.prisma.dispute.create({
      data: {
        filedById,
        taskId: dto.taskId,
        category: dto.category,
        subject: dto.subject,
        description: dto.description,
      },
    });
  }

  async listDisputes(dto: ListDisputesDto) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {};
    if (dto.status) where.status = dto.status;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          filedBy: { select: { id: true, email: true, name: true } },
          task: { select: { id: true, title: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async resolveDispute(id: string, dto: ResolveDisputeDto) {
    const d = await this.prisma.dispute.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dispute not found');
    const data: any = {
      status: dto.status,
      resolution: dto.resolution,
    };
    if (dto.status === 'RESOLVED' || dto.status === 'REJECTED') {
      data.resolvedAt = new Date();
    }
    return this.prisma.dispute.update({ where: { id }, data });
  }

  // ---- Audit logs ----
  async listAuditLogs(dto: ListAuditLogsDto) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {};
    if (dto.entityType) where.entityType = dto.entityType;
    if (dto.entityId) where.entityId = dto.entityId;
    if (dto.action) where.action = dto.action;
    if (dto.severity) where.severity = dto.severity;
    const [items, total] = await this.prisma.$transaction([
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
