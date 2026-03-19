import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class StoreTransferItemDto {
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
}

export class CreateStoreTransferDto {
  @IsString()
  target_warehouse: string

  @IsOptional()
  @IsString()
  note?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreTransferItemDto)
  items: StoreTransferItemDto[]
}
