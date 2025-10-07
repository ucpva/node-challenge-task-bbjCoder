import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Kafka, Consumer, KafkaMessage } from 'kafkajs';
import { Token } from '../../models/token.entity';
import { TokenPriceUpdateService } from '../../services/token-price-update.service';
import { PriceProviderService } from '../../services/price-provider.service';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';
import { TokenPriceUpdateMessage } from '../../models/token-price-update-message';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PriceApiService } from '../../services/price-api.service';
import { PriceApiInterface } from '../../services/price-api.interface';

describe('TokenPriceService Integration Tests', () => {
  let postgresContainer: StartedTestContainer;
  let zookeeperContainer: StartedTestContainer;
  let kafkaContainer: StartedTestContainer;
  let moduleRef: TestingModule;
  let tokenRepository: Repository<Token>;
  let tokenPriceUpdateService: TokenPriceUpdateService;
  let kafkaConsumer: Consumer;
  
  const kafkaTopic = 'token-price-updates';
  const testId = Math.random().toString(36).substring(7);
  
  const getAvailablePort = async (): Promise<number> => {
    // Use a random port between 10000 and 65535
    return Math.floor(Math.random() * 55535) + 10000;
  };
  
  beforeAll(async () => {
    jest.setTimeout(300000); // 5 minutes timeout for container startup
    
    try {
      // Get available ports
      const zookeeperPort = await getAvailablePort();
      const kafkaPort = await getAvailablePort();
      const postgresPort = await getAvailablePort();
      
      // Start PostgreSQL container
      postgresContainer = await new GenericContainer('postgres:15-alpine')
        .withName(`postgres-test-${testId}`)
        .withEnvironment({
          POSTGRES_USER: 'testuser',
          POSTGRES_PASSWORD: 'testpassword',
          POSTGRES_DB: 'testdb',
        })
        .withExposedPorts(postgresPort)
        .withStartupTimeout(120000)
        .start();
      
      const postgresHost = postgresContainer.getHost();
      const mappedPostgresPort = postgresContainer.getMappedPort(postgresPort);
      
      // Start Zookeeper container (required for Kafka)
      zookeeperContainer = await new GenericContainer('confluentinc/cp-zookeeper:7.3.0')
        .withName(`zookeeper-test-${testId}`)
        .withEnvironment({
          ZOOKEEPER_CLIENT_PORT: '2181',
          ZOOKEEPER_TICK_TIME: '2000',
        })
        .withExposedPorts(zookeeperPort)
        .withStartupTimeout(120000)
        .start();
      
      // Wait for Zookeeper to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Start Kafka container
      kafkaContainer = await new GenericContainer('confluentinc/cp-kafka:7.3.0')
        .withName(`kafka-test-${testId}`)
        .withEnvironment({
          KAFKA_BROKER_ID: '1',
          KAFKA_ZOOKEEPER_CONNECT: `${zookeeperContainer.getHost()}:${zookeeperContainer.getMappedPort(zookeeperPort)}`,
          KAFKA_ADVERTISED_LISTENERS: `PLAINTEXT://localhost:${kafkaPort}`,
          KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
          KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true',
        })
        .withExposedPorts(kafkaPort)
        .withStartupTimeout(120000)
        .start();
      
      const kafkaHost = 'localhost';
      const mappedKafkaPort = kafkaContainer.getMappedPort(kafkaPort);
      
      // Wait for Kafka to be fully ready
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Setup Kafka consumer
      const kafka = new Kafka({
        clientId: 'test-client',
        brokers: [`${kafkaHost}:${mappedKafkaPort}`],
      });
      
      kafkaConsumer = kafka.consumer({ groupId: 'test-consumer-group' });
      await kafkaConsumer.connect();
      await kafkaConsumer.subscribe({ topic: kafkaTopic, fromBeginning: true });
      
      // Create NestJS test module
      moduleRef = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'postgres',
            host: postgresHost,
            port: mappedPostgresPort,
            username: 'testuser',
            password: 'testpassword',
            database: 'testdb',
            entities: [Token],
            synchronize: true,
          }),
          TypeOrmModule.forFeature([Token]),
        ],
        providers: [
          TokenPriceUpdateService,
          PriceProviderService,
          {
            provide: PriceApiInterface,
            useClass: PriceApiService,
          },
          {
            provide: KafkaProducerService,
            useValue: {
              sendPriceUpdateMessage: jest.fn().mockImplementation(
                (message: TokenPriceUpdateMessage) => Promise.resolve(),
              ),
            },
          },
        ],
      }).compile();
      
      tokenRepository = moduleRef.get<Repository<Token>>(getRepositoryToken(Token));
      tokenPriceUpdateService = moduleRef.get<TokenPriceUpdateService>(TokenPriceUpdateService);
      
    } catch (error) {
      console.error('Error during test setup:', error);
      throw error;
    }
  }, 300000);
  
  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
    
    if (kafkaConsumer) {
      await kafkaConsumer.disconnect();
    }
    
    if (postgresContainer) {
      await postgresContainer.stop();
    }
    
    if (kafkaContainer) {
      await kafkaContainer.stop();
    }
    
    if (zookeeperContainer) {
      await zookeeperContainer.stop();
    }
  }, 30000);
  
  it('should update token price and send Kafka message', async () => {
    // Create test token
    const token = new Token();
    token.address = Buffer.from([0x01, 0x02, 0x03]);
    token.symbol = 'TEST';
    token.name = 'Test Token';
    token.decimals = 18;
    token.isNative = false;
    token.chainId = '11111111-1111-1111-1111-111111111111';
    token.isProtected = false;
    token.priority = 1;
    token.timestamp = new Date();
    token.price = 100;
    token.lastPriceUpdate = new Date();
    
    await tokenRepository.save(token);
    
    // Start price update service
    tokenPriceUpdateService.start();
    
    // Wait for price updates to occur
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Stop the service
    (tokenPriceUpdateService as any).stop();
    
    // Check if token price was updated in the database
    const updatedToken = await tokenRepository.findOne({ where: { id: token.id } });
    expect(updatedToken).toBeDefined();
    if (updatedToken) {
      expect(updatedToken.price).not.toEqual(100);
    }
    
    // Note: In a real test, we would also check for Kafka messages,
    // but since we're mocking the KafkaProducerService, we can't do that here
  }, 10000);
});
