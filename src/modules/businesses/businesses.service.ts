import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import {
  AddMemberDto,
  CreateBusinessDto,
  CreateWorkspaceDto,
  ListBusinessesDto,
  UpdateBusinessDto,
  UpdateMemberDto,
} from './dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerUserId: string, dto: CreateBusinessDto) {
    const exists = await this.prisma.business.findUnique({
      where: { slug: dto.slug },
    });
    if (exists) throw new ConflictException('Slug already taken');

    return this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({ data: { ...dto } });
      await tx.businessMember.create({
        data: {
          businessId: business.id,
          userId: ownerUserId,
          role: 'OWNER',
          joinedAt: new Date(),
        },
      });
      await tx.wallet.create({
        data: {
          ownerType: 'BUSINESS',
          ownerId: business.id,
          businessId: business.id,
        },
      });
      return business;
    });
  }

  async list(dto: ListBusinessesDto) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {};
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { slug: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.business.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const b = await this.prisma.business.findUnique({
      where: { id },
      include: {
        plan: true,
        workspaces: true,
        _count: { select: { agents: true, tasks: true, members: true } },
      },
    });
    if (!b) throw new NotFoundException('Business not found');
    return b;
  }

  async update(id: string, dto: UpdateBusinessDto) {
    await this.assertExists(id);
    return this.prisma.business.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.business.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    return { success: true };
  }

  // ---- Workspaces ----
  async listWorkspaces(businessId: string) {
    await this.assertExists(businessId);
    return this.prisma.workspace.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWorkspace(businessId: string, dto: CreateWorkspaceDto) {
    await this.assertExists(businessId);
    return this.prisma.workspace.create({
      data: { ...dto, businessId },
    });
  }

  async deleteWorkspace(businessId: string, workspaceId: string) {
    const ws = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, businessId },
    });
    if (!ws) throw new NotFoundException('Workspace not found');
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    return { success: true };
  }

  // ---- Members ----
  async listMembers(businessId: string) {
    await this.assertExists(businessId);
    return this.prisma.businessMember.findMany({
      where: { businessId },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
      },
    });
  }

  async addMember(businessId: string, dto: AddMemberDto) {
    await this.assertExists(businessId);
    const exists = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: dto.userId } },
    });
    if (exists) throw new ConflictException('User already a member');
    return this.prisma.businessMember.create({
      data: {
        businessId,
        userId: dto.userId,
        role: dto.role ?? 'MEMBER',
        workspaceId: dto.workspaceId,
        joinedAt: new Date(),
      },
    });
  }

  async updateMember(memberId: string, dto: UpdateMemberDto) {
    const m = await this.prisma.businessMember.findUnique({
      where: { id: memberId },
    });
    if (!m) throw new NotFoundException('Member not found');
    return this.prisma.businessMember.update({
      where: { id: memberId },
      data: { role: dto.role },
    });
  }

  async removeMember(memberId: string) {
    const m = await this.prisma.businessMember.findUnique({
      where: { id: memberId },
    });
    if (!m) throw new NotFoundException('Member not found');
    await this.prisma.businessMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  private async assertExists(id: string) {
    const b = await this.prisma.business.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!b) throw new NotFoundException('Business not found');
  }
}
