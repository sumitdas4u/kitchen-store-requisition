import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server } from 'socket.io'

@WebSocketGateway({ cors: true })
export class NotificationsGateway {
  @WebSocketServer()
  server: Server

  emit(event: string, payload: Record<string, unknown>) {
    this.server.emit(event, payload)
  }
}
