import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Role } from '../../common/enums'

export interface JwtPayload {
  sub: number
  username: string
  role: Role
  company: string
  default_warehouse: string | null
  source_warehouse: string | null
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')
    })
  }

  async validate(payload: JwtPayload) {
    return {
      user_id: payload.sub,
      username: payload.username,
      role: payload.role,
      company: payload.company,
      default_warehouse: payload.default_warehouse ?? null,
      source_warehouse: payload.source_warehouse ?? null
    }
  }
}
