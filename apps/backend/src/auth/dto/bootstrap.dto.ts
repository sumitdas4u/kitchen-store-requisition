import { IsEmail, IsString } from 'class-validator'

export class BootstrapDto {
  @IsString()
  username: string

  @IsString()
  full_name: string

  @IsEmail()
  email: string

  @IsString()
  password: string

  @IsString()
  company: string
}
