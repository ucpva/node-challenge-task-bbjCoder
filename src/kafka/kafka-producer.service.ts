import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Message } from 'kafkajs';
import { TokenPriceUpdateMessage, tokenPriceUpdateMessageSchema } from '../models/token-price-update-message';

@Injectable()
export class KafkaProducerService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly producer: Producer;
  private readonly topic: string = 'token-price-updates';
  private readonly dlqTopic: string = 'token-price-updates-dlq';

  constructor(private readonly configService: ConfigService) {
    const kafka = new Kafka({
      clientId: this.configService.get<string>('KAFKA_CLIENT_ID', 'token-price-service'),
      brokers: this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(','),
    });

    this.producer = kafka.producer();
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.logger.log('Connected to Kafka');
    } catch (error) {
      this.logger.error('Failed to connect to Kafka', error.stack);
    }
  }

  async sendPriceUpdateMessage(message: TokenPriceUpdateMessage): Promise<void> {
    try {
      // Validate the message with Zod schema
      tokenPriceUpdateMessageSchema.parse(message);
      
      await this.sendMessage(this.topic, message);

    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      // Retry logic for transient errors
      if (this.isTransientError(error)) {
        this.logger.warn('Retrying message send...');
        await this.retrySend(message);
      } else {
        await this.sendToDlq(message);
      }
    }
  }

  private async sendMessage(topic: string, message: TokenPriceUpdateMessage, attempt: number = 1): Promise<void> {
    const value = JSON.stringify(message);
    const kafkaMessage: Message = {
      key: message.tokenId,
      value,
    };

    await this.producer.send({
      topic: topic,
      messages: [kafkaMessage],
    });

    if (attempt > 1) {
      this.logger.log(`Message sent successfully to ${topic} on retry #${attempt}`);
    } else {
      this.logger.log(`Sent message to ${topic}: ${value}`);
    }
  }

  private async retrySend(message: TokenPriceUpdateMessage, retries = 3): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.sendMessage(this.topic, message, attempt);
        return;
      } catch (error) {
        this.logger.warn(`Retry #${attempt} failed: ${error.message}`);
        if (attempt === retries) {
          this.logger.error('All retry attempts failed');
          await this.sendToDlq(message);
        }
      }
    }
  }

  private async sendToDlq(message: TokenPriceUpdateMessage): Promise<void> {
    try {
      this.logger.log(`Sending message to DLQ topic: ${this.dlqTopic}`);
      await this.sendMessage(this.dlqTopic, message);
    } catch (error) {
      this.logger.error(`Failed to send message to DLQ: ${error.message}`);
    }
  }

  private isTransientError(error: any): boolean {
    // Define logic to identify transient errors
    return error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT';
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.logger.log('Disconnected from Kafka');
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', error.stack);
    }
  }
}
