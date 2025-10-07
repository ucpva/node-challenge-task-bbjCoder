import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PriceApiInterface } from './price-api.interface';

enum CircuitBreakerState {
  Closed,
  Open,
  HalfOpen,
}

@Injectable()
export class PriceApiService implements PriceApiInterface {
  private readonly logger = new Logger(PriceApiService.name);
  private readonly apiUrl: string;
  private readonly timeout: number;
  private readonly apiIds: Record<string, string>;

  private state: CircuitBreakerState = CircuitBreakerState.Closed;
  private failureCount = 0;
  private readonly failureThreshold = 3;
  private readonly openStateTimeout = 60000;
  private lastFailureTime: number | null = null;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('API_URL', 'https://api.coingecko.com/api/v3/simple/price');
    this.timeout = this.configService.get<number>('API_TIMEOUT', 5000);
    this.apiIds = {
      ETH: 'ethereum',
      BTC: 'bitcoin',
      SOL: 'solana',
    };
  }

  async fetchPrice(symbol: string): Promise<number | null> {
    if (this.state === CircuitBreakerState.Open) {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.openStateTimeout) {
        this.state = CircuitBreakerState.HalfOpen;
        this.logger.warn('Circuit breaker is now in Half-Open state.');
      } else {
        this.logger.warn('Circuit breaker is open. Request blocked.');
        return null;
      }
    }

    try {
      const apiId = this.getApiId(symbol);
      if (!apiId) {
        this.logger.warn(`Unsupported token symbol: ${symbol}`);
        return null;
      }

      const response = await axios.get(this.apiUrl, {
        params: {
          ids: apiId,
          vs_currencies: 'usd',
        },
        timeout: this.timeout,
      });

      const price = response.data[apiId]?.usd;
      if (price) {
        this.resetCircuitBreaker();
        return price;
      } else {
        this.logger.warn(`Price not found for symbol: ${symbol}`);
        return null;
      }
    } catch (error) {
      this.handleFailure();
      this.logger.error(`Failed to fetch price for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  private getApiId(symbol: string): string {
    return this.apiIds[symbol] || '';
  }

  private handleFailure() {
    this.failureCount++;
    if (this.state === CircuitBreakerState.HalfOpen || this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.Open;
      this.lastFailureTime = Date.now();
      this.logger.error('Circuit breaker is now in Open state.');
    }
  }

  private resetCircuitBreaker() {
    this.state = CircuitBreakerState.Closed;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.logger.log('Circuit breaker is reset to Closed state.');
  }
}