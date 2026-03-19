import { Type } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'
import { Shift } from '../../common/enums'

class RequisitionItemInput {
  @IsString()
  item_code: string

  @IsString()
  item_name: string

  @IsString()
  uom: string

  @Type(() => Number)
  @IsNumber()
  closing_stock: number

  @Type(() => Number)
  @IsNumber()
  order_qty: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  actual_closing?: number
}

export class CreateRequisitionDto {
  @IsDateString()
  requested_date: string

  @IsIn([Shift.Morning, Shift.Evening])
  shift: Shift

  @IsOptional()
  @IsString()
  notes?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequisitionItemInput)
  items: RequisitionItemInput[]
}
