import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '../common/enums'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RequisitionService } from './requisition.service'
import { CreateRequisitionDto } from './dto/create-requisition.dto'
import { IssueRequisitionDto } from './dto/issue-requisition.dto'
import { ConfirmRequisitionDto } from './dto/confirm-requisition.dto'

@Controller('requisition')
export class RequisitionController {
  constructor(private readonly requisitionService: RequisitionService) {}

  @Roles(Role.Kitchen)
  @Post()
  async create(
    @CurrentUser()
    user: {
      user_id: number
      company: string
      default_warehouse?: string | null
      source_warehouse?: string | null
    },
    @Body() body: CreateRequisitionDto
  ) {
    return this.requisitionService.createDraft(user, body)
  }

  @Roles(Role.Kitchen)
  @Put(':id/submit')
  async submit(@Param('id') id: string) {
    return this.requisitionService.submit(Number(id))
  }

  @Roles(Role.Kitchen)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: CreateRequisitionDto
  ) {
    return this.requisitionService.updateDraft(Number(id), body)
  }

  @Get()
  async list(
    @CurrentUser() user: { role: Role; default_warehouse?: string | null }
  ) {
    return this.requisitionService.list(user.role, user.default_warehouse)
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.requisitionService.getOne(Number(id))
  }

  @Roles(Role.Store)
  @Put(':id/issue')
  async issue(@Param('id') id: string, @Body() body: IssueRequisitionDto) {
    return this.requisitionService.issue(Number(id), body)
  }

  @Roles(Role.Kitchen)
  @Put(':id/confirm')
  async confirm(
    @Param('id') id: string,
    @Body() body: ConfirmRequisitionDto
  ) {
    return this.requisitionService.confirm(Number(id), body)
  }

  @Roles(Role.Kitchen)
  @Put(':id/finalize')
  async finalize(@Param('id') id: string) {
    return this.requisitionService.finalize(Number(id))
  }

  @Roles(Role.Store, Role.Admin)
  @Put(':id/reject')
  async reject(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.requisitionService.reject(Number(id), body?.reason)
  }

  @Roles(Role.Kitchen)
  @Put(':id/cancel')
  async cancel(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.requisitionService.cancelByKitchen(Number(id), body?.reason)
  }

  @Roles(Role.Admin)
  @Put(':id/resolve')
  async resolve(@Param('id') id: string) {
    return this.requisitionService.resolve(Number(id))
  }

  @Roles(Role.Kitchen)
  @Put(':id/delete')
  async deleteDraft(@Param('id') id: string) {
    return this.requisitionService.deleteDraft(Number(id))
  }
}
