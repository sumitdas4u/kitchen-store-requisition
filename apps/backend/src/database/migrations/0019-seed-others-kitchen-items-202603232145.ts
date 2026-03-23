import { MigrationInterface, QueryRunner } from 'typeorm'

const TARGET_COMPANY = 'Food Studio Restaurant and Cafe'
const TARGET_WAREHOUSE = 'Others Kitchen - FSRaC'

const ITEM_CODES = [
  'FS/INV/01051',
  'FS/INV/01052',
  'FS/INV/01053',
  'SKILL/INV/00353',
  'FS/INV/00009',
  'FS/INV/01067',
  'SKILL/INV/00355',
  'SKILL/INV/00356',
  'FS/INV/00739',
  'FS/INV/01055',
  'SKILL/INV/00357',
  'FS/INV/00762',
  'FS/INV/00766',
  'FS/INV/00590',
  'FS/INV/00764',
  'FS/INV/00591',
  'FS/INV/01168',
  'FS/INV/00574',
  'FS/INV/00573',
  'FS/INV/00959',
  'FS/INV/00960',
  'FS/INV/01159',
  'FS/INV/00810',
  'SKILL/INV/00407',
  'FS/INV/01069',
  'FS/INV/01108',
  'SKILL/INV/00514',
  'SKILL/INV/00553',
  'SKILL/INV/00558',
  'SKILL/INV/00557',
  'SKILL/INV/00556',
  'SKILL/INV/00552',
  'SKILL/INV/00572',
  'SKILL/INV/00586',
  'SKILL/INV/00564',
  'SKILL/INV/00571',
  'SKILL/INV/00544',
  'SKILL/INV/00454',
] as const

export class SeedOthersKitchenItems20260323214500
  implements MigrationInterface
{
  name = 'SeedOthersKitchenItems20260323214500'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS warehouse_items (
        id SERIAL PRIMARY KEY,
        warehouse VARCHAR(200) NOT NULL,
        item_code VARCHAR(200) NOT NULL,
        company VARCHAR(200) NOT NULL,
        UNIQUE(warehouse, item_code)
      );
    `)

    const uniqueCodes = [...new Set(ITEM_CODES)]
    const placeholders = uniqueCodes
      .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(', ')
    const params = uniqueCodes.flatMap((itemCode) => [
      TARGET_WAREHOUSE,
      itemCode,
      TARGET_COMPANY,
    ])

    await queryRunner.query(
      `INSERT INTO warehouse_items (warehouse, item_code, company)
       VALUES ${placeholders}
       ON CONFLICT DO NOTHING`,
      params,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const uniqueCodes = [...new Set(ITEM_CODES)]
    const placeholders = uniqueCodes
      .map((_, i) => `$${i + 2}`)
      .join(', ')

    await queryRunner.query(
      `DELETE FROM warehouse_items
       WHERE warehouse = $1
         AND item_code IN (${placeholders})`,
      [TARGET_WAREHOUSE, ...uniqueCodes],
    )
  }
}
