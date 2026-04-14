import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import {
  AddAvailabilitySlotDto,
  AddSkillDto,
  CreateAgentDto,
  ListAgentsDto,
  SetAvailabilityDto,
  UpdateAgentDto,
  UpdateAgentStatusDto,
  UpdateKycDto,
} from './dto';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const [items, total] = await this.prisma.$transaction([
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { rating: 'desc' },
        include: {
          user: { select: { id: true, email: true, name: true } },
          skills: true,
        },
      }),
      this.prisma.agent.count({ where }),
    ]);
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

  private async assertExists(id: string) {
    const a = await this.prisma.agent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!a) throw new NotFoundException('Agent not found');
  }
}
