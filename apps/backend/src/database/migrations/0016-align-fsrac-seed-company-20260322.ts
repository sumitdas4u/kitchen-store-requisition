import { MigrationInterface, QueryRunner } from 'typeorm'

const TARGET_COMPANY = 'Food Studio Restaurant and Cafe'
const LEGACY_COMPANY = 'Food Studio'

export class AlignFsracSeedCompany20260322103000 implements MigrationInterface {
  name = 'AlignFsracSeedCompany20260322103000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      UPDATE users
      SET company = $1
      WHERE company = $2
        AND (
          default_warehouse LIKE '% - FSRaC'
          OR source_warehouse LIKE '% - FSRaC'
        )
      `,
      [TARGET_COMPANY, LEGACY_COMPANY],
    )

    await queryRunner.query(
      `
      UPDATE warehouse_items
      SET company = $1
      WHERE company = $2
        AND warehouse LIKE '% - FSRaC'
      `,
      [TARGET_COMPANY, LEGACY_COMPANY],
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      UPDATE users
      SET company = $1
      WHERE company = $2
        AND (
          default_warehouse LIKE '% - FSRaC'
          OR source_warehouse LIKE '% - FSRaC'
        )
      `,
      [LEGACY_COMPANY, TARGET_COMPANY],
    )

    await queryRunner.query(
      `
      UPDATE warehouse_items
      SET company = $1
      WHERE company = $2
        AND warehouse LIKE '% - FSRaC'
      `,
      [LEGACY_COMPANY, TARGET_COMPANY],
    )
  }
}
