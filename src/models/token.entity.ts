import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tokens')
export class Token {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bytea', unique: true })
  address: Buffer;

  @Column({ nullable: false, unique: true })
  symbol: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'smallint', default: 0 })
  decimals: number;

  @Column({ default: false })
  isNative: boolean;

  @Column({ type: 'uuid' })
  chainId: string;

  @Column({ default: false })
  isProtected: boolean;

  @Column({ nullable: true })
  lastUpdateAuthor: string;

  @Column({ default: 0 })
  priority: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  price: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastPriceUpdate: Date;

  // Removed denormalized fields for chain and logo data
}
