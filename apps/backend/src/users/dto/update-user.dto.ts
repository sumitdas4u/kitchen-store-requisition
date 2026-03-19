import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator'
import { Role } from '../../common/enums'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  full_name?: string

  @IsOptional()
  @IsString()
  email?: string

  @IsOptional()
  @IsString()
  password?: string

  @IsOptional()
  @IsIn([Role.Kitchen, Role.Store, Role.Admin])
  role?: Role

  @IsOptional()
  @IsString()
  company?: string

  @IsOptional()
  @IsString()
  default_warehouse?: string

  @IsOptional()
  @IsString()
  source_warehouse?: string

  @IsOptional()
  @IsArray()
  warehouses?: string[]

  @IsOptional()
  @IsBoolean()
  is_active?: boolean
}
