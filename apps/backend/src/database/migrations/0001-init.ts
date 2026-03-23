import { MigrationInterface, QueryRunner } from 'typeorm'

export class Init20260315090000 implements MigrationInterface {
  name = 'Init20260315090000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(200) NOT NULL,
        email VARCHAR(200) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        company VARCHAR(200) NOT NULL,
        default_warehouse VARCHAR(200),
        source_warehouse VARCHAR(200),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_warehouses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        warehouse VARCHAR(200) NOT NULL,
        UNIQUE(user_id, warehouse)
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS requisitions (
        id SERIAL PRIMARY KEY,
        erp_name VARCHAR(100),
        user_id INTEGER REFERENCES users(id),
        warehouse VARCHAR(200) NOT NULL,
        source_warehouse VARCHAR(200) NOT NULL,
        company VARCHAR(200) NOT NULL,
        requested_date DATE NOT NULL,
        shift VARCHAR(20) NOT NULL,
        status VARCHAR(50) DEFAULT 'Draft',
        stock_entry VARCHAR(100),
        queue_job_id VARCHAR(100),
        notes TEXT,
        submitted_at TIMESTAMP,
        issued_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS requisition_items (
        id SERIAL PRIMARY KEY,
        requisition_id INTEGER REFERENCES requisitions(id) ON DELETE CASCADE,
        item_code VARCHAR(200) NOT NULL,
        item_name VARCHAR(200),
        uom VARCHAR(50),
        closing_stock DECIMAL(18,3) DEFAULT 0,
        required_qty DECIMAL(18,3) DEFAULT 0,
        requested_qty DECIMAL(18,3) DEFAULT 0,
        issued_qty DECIMAL(18,3) DEFAULT 0,
        received_qty DECIMAL(18,3) DEFAULT 0,
        item_status VARCHAR(50) DEFAULT 'Pending'
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS warehouse_item_groups (
        id SERIAL PRIMARY KEY,
        warehouse VARCHAR(200) NOT NULL,
        item_group VARCHAR(200) NOT NULL,
        company VARCHAR(200) NOT NULL,
        UNIQUE(warehouse, item_group)
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        company VARCHAR(200),
        erp_base_url VARCHAR(500),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS app_settings')
    await queryRunner.query('DROP TABLE IF EXISTS warehouse_item_groups')
    await queryRunner.query('DROP TABLE IF EXISTS requisition_items')
    await queryRunner.query('DROP TABLE IF EXISTS requisitions')
    await queryRunner.query('DROP TABLE IF EXISTS user_warehouses')
    await queryRunner.query('DROP TABLE IF EXISTS users')
  }
}
