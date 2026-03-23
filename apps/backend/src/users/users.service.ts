import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, QueryFailedError, Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { User } from '../database/entities/user.entity'
import { UserWarehouse } from '../database/entities/user-warehouse.entity'
import { ErpWarehouseCache } from '../database/entities/erp-warehouse-cache.entity'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { Role } from '../common/enums'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserWarehouse)
    private readonly warehousesRepo: Repository<UserWarehouse>,
    @InjectRepository(ErpWarehouseCache)
    private readonly erpWarehouseCacheRepo: Repository<ErpWarehouseCache>
  ) {}

  async findActiveByUsername(username: string) {
    return this.usersRepo.findOne({
      where: [
        { username, is_active: true },
        { email: username, is_active: true }
      ],
      relations: ['warehouses']
    })
  }

  async listUsers() {
    return this.usersRepo.find({ relations: ['warehouses'] })
  }

  async countUsers() {
    return this.usersRepo.count()
  }

  async countAdmins() {
    return this.usersRepo.count({
      where: { role: Role.Admin }
    })
  }

  async resolveEffectiveCompany(user: {
    company?: string | null
    default_warehouse?: string | null
    source_warehouse?: string | null
  }) {
    return this.resolveCompanyFromWarehouses(
      user.company,
      user.source_warehouse,
      user.default_warehouse
    )
  }

  async getUser(id: number) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['warehouses']
    })
    if (!user) {
      throw new NotFoundException('User not found')
    }
    return user
  }

  async createUser(dto: CreateUserDto) {
    if (!dto.warehouses || dto.warehouses.length === 0) {
      throw new BadRequestException('At least one warehouse is required')
    }
    if (dto.default_warehouse && !dto.warehouses.includes(dto.default_warehouse)) {
      throw new BadRequestException('Default warehouse must be in warehouses list')
    }

    const password_hash = await bcrypt.hash(dto.password, 10)
    const user = this.usersRepo.create({
      username: dto.username,
      full_name: dto.full_name,
      email: dto.email,
      password_hash,
      role: dto.role,
      company: dto.company,
      default_warehouse: dto.default_warehouse ?? null,
      source_warehouse: dto.source_warehouse ?? null,
      is_active: true
    })
    try {
      const saved = await this.usersRepo.save(user)
      await this.saveWarehouses(saved.id, dto.warehouses)
      return this.getUser(saved.id)
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = (error as any).code
        if (code === '23505') {
          throw new BadRequestException('Username or email already exists')
        }
      }
      throw error
    }
  }

  async createBootstrapAdmin(payload: {
    username: string
    full_name: string
    email: string
    password_hash: string
    company: string
  }) {
    const user = this.usersRepo.create({
      username: payload.username,
      full_name: payload.full_name,
      email: payload.email,
      password_hash: payload.password_hash,
      role: Role.Admin,
      company: payload.company,
      default_warehouse: null,
      source_warehouse: null,
      is_active: true
    })
    return this.usersRepo.save(user)
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const user = await this.getUser(id)
    if (dto.warehouses && dto.warehouses.length > 0) {
      if (dto.default_warehouse && !dto.warehouses.includes(dto.default_warehouse)) {
        throw new BadRequestException('Default warehouse must be in warehouses list')
      }
      await this.replaceWarehouses(id, dto.warehouses)
    }
    if (dto.password) {
      user.password_hash = await bcrypt.hash(dto.password, 10)
    }
    if (dto.full_name !== undefined) user.full_name = dto.full_name
    if (dto.email !== undefined) user.email = dto.email
    if (dto.role !== undefined) user.role = dto.role
    if (dto.company !== undefined) user.company = dto.company
    if (dto.default_warehouse !== undefined) user.default_warehouse = dto.default_warehouse
    if (dto.source_warehouse !== undefined) user.source_warehouse = dto.source_warehouse
    if (dto.is_active !== undefined) user.is_active = dto.is_active

    try {
      await this.usersRepo.save(user)
      return this.getUser(id)
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = (error as any).code
        if (code === '23505') {
          throw new BadRequestException('Username or email already exists')
        }
      }
      throw error
    }
  }

  async getUserWarehouses(userId: number): Promise<string[]> {
    const rows = await this.warehousesRepo.find({
      where: { user_id: userId },
      order: { warehouse: 'ASC' }
    })
    return rows.map(r => r.warehouse).filter(Boolean)
  }

  async hasWarehouseAccess(userId: number, warehouse: string): Promise<boolean> {
    const count = await this.warehousesRepo.count({
      where: { user_id: userId, warehouse }
    })
    return count > 0
  }

  async deactivateUser(id: number) {
    const user = await this.getUser(id)
    user.is_active = false
    await this.usersRepo.save(user)
    return { ok: true }
  }

  private async saveWarehouses(userId: number, warehouses: string[]) {
    const rows = warehouses.map((warehouse) =>
      this.warehousesRepo.create({ user_id: userId, warehouse })
    )
    await this.warehousesRepo.save(rows)
  }

  private async replaceWarehouses(userId: number, warehouses: string[]) {
    await this.warehousesRepo.delete({ user_id: userId })
    await this.saveWarehouses(userId, warehouses)
  }

  private async resolveCompanyFromWarehouses(
    fallbackCompany: string | null | undefined,
    ...warehouses: Array<string | null | undefined>
  ) {
    const uniqueWarehouses = Array.from(
      new Set(
        warehouses
          .map((warehouse) => warehouse?.trim())
          .filter((warehouse): warehouse is string => Boolean(warehouse))
      )
    )

    if (uniqueWarehouses.length > 0) {
      const warehouseRows = await this.erpWarehouseCacheRepo.find({
        where: { name: In(uniqueWarehouses) }
      })
      const companies = Array.from(
        new Set(
          warehouseRows
            .map((row) => row.company?.trim())
            .filter((company): company is string => Boolean(company))
        )
      )

      if (companies.length > 1) {
        throw new BadRequestException(
          'Assigned warehouses belong to different companies in ERP'
        )
      }
      if (companies[0]) {
        return companies[0]
      }
    }

    if (fallbackCompany?.trim()) {
      return fallbackCompany.trim()
    }

    throw new BadRequestException('Company is required')
  }
}
