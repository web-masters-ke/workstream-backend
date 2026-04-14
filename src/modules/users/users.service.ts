import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pageParams } from '../../common/dto/pagination.dto';
import {
  ListUsersDto,
  UpdateProfileDto,
  UpdateRoleDto,
  UpdateStatusDto,
} from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListUsersDto) {
    const { skip, limit, page } = pageParams(dto);
    const where: any = {};
    if (dto.role) where.role = dto.role;
    if (dto.status) where.status = dto.status;
    if (dto.email) where.email = { contains: dto.email, mode: 'insensitive' };
    if (dto.search) {
      where.OR = [
        { email: { contains: dto.search, mode: 'insensitive' } },
        { name: { contains: dto.search, mode: 'insensitive' } },
        { firstName: { contains: dto.search, mode: 'insensitive' } },
        { lastName: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: this.safeSelect,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.safeSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    await this.assertExists(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.safeSelect,
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    await this.assertExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: this.safeSelect,
    });
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    await this.assertExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: this.safeSelect,
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.user.update({
      where: { id },
      data: { status: 'DELETED' },
    });
    return { success: true };
  }

  private async assertExists(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!u) throw new NotFoundException('User not found');
  }

  private safeSelect = {
    id: true,
    email: true,
    phone: true,
    firstName: true,
    lastName: true,
    name: true,
    avatarUrl: true,
    role: true,
    status: true,
    emailVerified: true,
    phoneVerified: true,
    mfaEnabled: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}
