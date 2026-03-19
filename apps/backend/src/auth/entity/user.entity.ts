import { Role } from '../../common/enums'

export class UserEntity {
  user_id: number
  username: string
  role: Role
  company: string
  default_warehouse?: string | null
  source_warehouse?: string | null
}
