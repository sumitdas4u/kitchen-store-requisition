import { Injectable } from '@nestjs/common'
import axios from 'axios'
import { ConfigService } from '@nestjs/config'
import { QueueService } from '../queue/queue.service'
import { RequisitionStatus } from '../common/enums'
import { NotificationsGateway } from './notifications.gateway'

@Injectable()
export class NotificationsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly gateway: NotificationsGateway
  ) {}

  async enqueueWhatsApp(
    to: string[],
    templateName: string,
    params: Record<string, unknown>
  ) {
    return this.queueService.enqueueWhatsApp({ to, templateName, params })
  }

  async sendWhatsApp(
    to: string | string[],
    templateName: string,
    params: Record<string, unknown>
  ) {
    const url = `${this.configService.get<string>('WHATSAPP_API_URL')}/messages`
    const token = this.configService.get<string>('WHATSAPP_API_TOKEN')
    const numbers = Array.isArray(to) ? to : [to]

    const requests = numbers.map((phoneNumber) =>
      axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [{ type: 'body', parameters: this.toParams(params) }]
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      )
    )

    await Promise.all(requests)
    return { ok: true }
  }

  async notifyStatusChange(requisitionId: string, newStatus: RequisitionStatus) {
    const template = this.templateForStatus(newStatus)
    if (!template) {
      return { ok: true }
    }
    this.gateway.emit('requisition_status', { requisitionId, status: newStatus })

    const recipients = await this.resolveRecipients(requisitionId, newStatus)
    if (recipients.length === 0) {
      return { ok: true }
    }
    return this.enqueueWhatsApp(recipients, template, { requisitionId })
  }

  private templateForStatus(status: RequisitionStatus) {
    switch (status) {
      case RequisitionStatus.Submitted:
        return 'requisition_submitted'
      case RequisitionStatus.Issued:
        return 'items_issued'
      case RequisitionStatus.PartiallyIssued:
        return 'items_partially_issued'
      case RequisitionStatus.Disputed:
        return 'disputed'
      case RequisitionStatus.Completed:
        return 'completed'
      default:
        return null
    }
  }

  private async resolveRecipients(
    requisitionId: string,
    status: RequisitionStatus
  ): Promise<string[]> {
    const adminNumbers = this.parseNumbers(
      this.configService.get<string>('WHATSAPP_ADMIN_NUMBERS')
    )
    const storeNumbers = this.parseNumbers(
      this.configService.get<string>('WHATSAPP_STORE_NUMBERS')
    )

    if (status === RequisitionStatus.Submitted) {
      return storeNumbers
    }

    if (
      status === RequisitionStatus.Issued ||
      status === RequisitionStatus.PartiallyIssued
    ) {
      return []
    }

    if (
      status === RequisitionStatus.Disputed ||
      status === RequisitionStatus.Completed
    ) {
      return adminNumbers
    }

    return []
  }

  private parseNumbers(value?: string | null): string[] {
    if (!value) {
      return []
    }
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  }

  private toParams(params: object) {
    return Object.values(params).map((value) => ({
      type: 'text',
      text: String(value)
    }))
  }
}
