import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

class IssueItemInput {
  @IsString()
  item_code: string

  @Type(() => Number)
  @IsNumber()
  issued_qty: number
}

export class IssueRequisitionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueItemInput)
  items: IssueItemInput[]

  @IsOptional()
  @IsString()
  store_note?: string
}
