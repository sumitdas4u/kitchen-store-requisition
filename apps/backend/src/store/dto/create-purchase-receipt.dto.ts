import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class PurchaseReceiptLineDto {
  @IsString()
  item_code: string

  @IsNumber()
  qty: number

  @IsOptional()
  @IsString()
  item_name?: string

  @IsOptional()
  @IsString()
  uom?: string
}

export class CreatePurchaseReceiptDto {
  @IsOptional()
  @IsString()
  po_id?: string

  @IsString()
  vendor_id: string

  @IsOptional()
  @IsString()
  vendor_name?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseReceiptLineDto)
  lines: PurchaseReceiptLineDto[]
}
