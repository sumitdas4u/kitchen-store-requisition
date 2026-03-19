import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Public } from '../common/decorators/public.decorator'
import { BootstrapDto } from './dto/bootstrap.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.username, body.password)
  }

  @Public()
  @Post('bootstrap')
  async bootstrap(@Body() body: BootstrapDto) {
    return this.authService.bootstrap(body)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(
    @CurrentUser()
    user: {
      user_id: number
      username: string
      role: string
      company: string
      default_warehouse?: string | null
      source_warehouse?: string | null
    }
  ) {
    return user
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout() {
    return { ok: true }
  }
}
