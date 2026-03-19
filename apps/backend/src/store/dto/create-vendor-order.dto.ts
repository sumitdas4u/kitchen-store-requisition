import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'

export class VendorOrderLineDto {
  @IsString()
  item_code: string

  @IsOptional()
  @IsString()
  item_name?: string

  @IsOptional()
  @IsString()
  uom?: string

  @IsNumber()
  qty: number

  @IsNumber()
  price: number

  @IsString()
  vendor_id: string

  @IsOptional()
  @IsBoolean()
  is_manual?: boolean
}

export class CreateVendorOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorOrderLineDto)
  lines: VendorOrderLineDto[]
}
