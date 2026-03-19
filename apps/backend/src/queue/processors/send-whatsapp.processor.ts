import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Injectable } from '@nestjs/common'
import { QUEUE_NAMES } from '../../common/constants'
import { NotificationsService } from '../../notifications/notifications.service'

@Processor(QUEUE_NAMES.SendWhatsApp)
@Injectable()
export class SendWhatsAppProcessor extends WorkerHost {
  constructor(private readonly notificationsService: NotificationsService) {
    super()
  }

  async process(
    job: Job<{
      to: string[]
      templateName: string
      params: Record<string, unknown>
    }>
  ) {
    const { to, templateName, params } = job.data
    return this.notificationsService.sendWhatsApp(to, templateName, params)
  }
}
