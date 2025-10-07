import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1684654321000 implements MigrationInterface {
    name = 'InitialMigration1684654321000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "tokens" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "address" bytea NOT NULL,
                "symbol" character varying NOT NULL,
                "name" character varying NOT NULL,
                "decimals" smallint NOT NULL DEFAULT '0',
                "isNative" boolean NOT NULL DEFAULT false,
                "chainId" uuid NOT NULL,
                "isProtected" boolean NOT NULL DEFAULT false,
                "lastUpdateAuthor" character varying,
                "priority" integer NOT NULL DEFAULT '0',
                "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "price" numeric(28,8) NOT NULL DEFAULT '0',
                "lastPriceUpdate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_tokens" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_tokens_address" UNIQUE ("address"),
                CONSTRAINT "UQ_tokens_symbol" UNIQUE ("symbol")
            )
        `);

        // Create index for performance optimization
        await queryRunner.query(`CREATE INDEX "IDX_tokens_chainId" ON "tokens" ("chainId")`);
        await queryRunner.query(`CREATE INDEX "IDX_tokens_price" ON "tokens" ("price")`);

        // Ensure UUID extension exists
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_tokens_price"`);
        await queryRunner.query(`DROP INDEX "IDX_tokens_chainId"`);
        await queryRunner.query(`DROP TABLE "tokens"`);
    }
}
