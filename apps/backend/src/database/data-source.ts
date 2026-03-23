import { DataSource } from 'typeorm'
import { config } from 'dotenv'
import { join } from 'path'

config({ path: join(__dirname, '..', '..', '.env') })

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://kitchen:kitchen_pass@localhost:5433/kitchen_app',
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false,
  ssl: false,
})
