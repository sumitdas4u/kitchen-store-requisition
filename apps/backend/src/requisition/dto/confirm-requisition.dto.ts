import { Type } from 'class-transformer'
import { IsArray, IsIn, IsNumber, IsString, ValidateNested } from 'class-validator'

class ConfirmItemInput {
  @IsString()
  item_code: string

  @Type(() => Number)
  @IsNumber()
  received_qty: number

  @IsIn(['accept', 'partial', 'reject'])
  action: 'accept' | 'partial' | 'reject'
}

export class ConfirmRequisitionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmItemInput)
  items: ConfirmItemInput[]
}
