import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { UsersService } from '../users/users.service'
import { BootstrapDto } from './dto/bootstrap.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersService.findActiveByUsername(username)
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      company: user.company,
      default_warehouse: user.default_warehouse,
      source_warehouse: user.source_warehouse
    }

    return {
      access_token: await this.jwtService.signAsync(payload),
      role: payload.role,
      default_warehouse: payload.default_warehouse,
      source_warehouse: payload.source_warehouse
    }
  }

  async bootstrap(dto: BootstrapDto) {
    const count = await this.usersService.countUsers()
    if (count > 0) {
      throw new ForbiddenException('Bootstrap already completed')
    }

    const password_hash = await bcrypt.hash(dto.password, 10)
    await this.usersService.createBootstrapAdmin({
      username: dto.username,
      full_name: dto.full_name,
      email: dto.email,
      password_hash,
      company: dto.company
    })

    return { message: 'Admin user created. Bootstrap endpoint is now disabled.' }
  }
}
