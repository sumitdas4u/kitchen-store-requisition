import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({
    origin: true,
    credentials: true,
  })
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true })
  )

  const configService = app.get(ConfigService)
  const port = Number(configService.get<string>('PORT') || 3001)
  await app.listen(port, '0.0.0.0')
}

bootstrap()
