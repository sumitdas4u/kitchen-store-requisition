import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface CurrentUser {
  user_id: number
  username: string
  role: string
  company: string
  default_warehouse?: string | null
  source_warehouse?: string | null
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest()
    return request.user as CurrentUser
  }
)
