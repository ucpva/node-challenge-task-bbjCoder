import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Token } from './models/token.entity';
import { TokenPriceUpdateService } from './services/token-price-update.service';
import { PriceProviderService } from './services/price-provider.service';
import { KafkaProducerService } from './kafka/kafka-producer.service';
import { TokenSeeder } from './data/token.seeder';
import { PriceApiService } from './services/price-api.service';
import { PriceApiInterface } from './services/price-api.interface';

function validate(config: Record<string, any>) {
  const requiredKeys = [
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
    'KAFKA_CLIENT_ID',
    'KAFKA_BROKERS',
    'API_URL',
  ];

  for (const key of requiredKeys) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make environment variables globally available
      envFilePath: '.env', // Load variables from .env file
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [Token],
        migrations: [__dirname + '/migrations/*.{js,ts}'],
        migrationsRun: false, // Disable automatic migrations
        synchronize: false, // Ensure schema synchronization is disabled
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Token]),
  ],
  controllers: [],
  providers: [
    TokenPriceUpdateService,
    PriceProviderService,
    KafkaProducerService,
    TokenSeeder,
    {
      provide: PriceApiInterface,
      useClass: PriceApiService,
    },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly tokenSeeder: TokenSeeder,
    private readonly tokenPriceUpdateService: TokenPriceUpdateService,
  ) {}

  async onModuleInit() {
    // Seed initial data
    await this.tokenSeeder.seed();
    
    // Start price update service
    this.tokenPriceUpdateService.start();
  }
}
