import { IsArray, IsEmail, IsIn, IsOptional, IsString } from 'class-validator'
import { Role } from '../../common/enums'

export class CreateUserDto {
  @IsString()
  username: string

  @IsString()
  full_name: string

  @IsEmail()
  email: string

  @IsString()
  password: string

  @IsIn([Role.Kitchen, Role.Store, Role.Admin])
  role: Role

  @IsString()
  company: string

  @IsOptional()
  @IsString()
  default_warehouse?: string

  @IsOptional()
  @IsString()
  source_warehouse?: string

  @IsArray()
  warehouses: string[]
}
