import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'

export class VendorOrderRequestSourceDto {
  @IsNumber()
  requisition_id: number

  @IsString()
  warehouse: string

  @IsDateString()
  requested_date: string

  @IsNumber()
  remaining_qty: number
}

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorOrderRequestSourceDto)
  request_sources?: VendorOrderRequestSourceDto[]
}

export class CreateVendorOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorOrderLineDto)
  lines: VendorOrderLineDto[]
}
