import { MigrationInterface, QueryRunner } from 'typeorm'

export class PriceChangeLog20260317200000 implements MigrationInterface {
  name = 'PriceChangeLog20260317200000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS price_change_log (
        id              SERIAL PRIMARY KEY,
        item_code       VARCHAR(200) NOT NULL,
        item_name       VARCHAR(300),
        price_list      VARCHAR(200) NOT NULL,
        old_price       DECIMAL(18,3),
        new_price       DECIMAL(18,3) NOT NULL,
        changed_by_id   INTEGER,
        changed_by_name VARCHAR(200),
        changed_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_price_change_log_item
        ON price_change_log(item_code);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS price_change_log;`)
  }
}
