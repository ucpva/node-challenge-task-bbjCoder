import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { Token } from '../models/token.entity';
import { PriceApiInterface } from './price-api.interface';

class TokenPriceError extends Error {
  constructor(message: string, public readonly tokenSymbol: string) {
    super(message);
    this.name = 'TokenPriceError';
  }
}

@Injectable()
export class PriceProviderService {
  private readonly logger = new Logger(PriceProviderService.name);

  constructor(
    @Inject(PriceApiInterface) private readonly priceApiService: PriceApiInterface,
  ) {}

  async getPriceForToken(token: Token): Promise<number> {
    if (!token || !token.symbol) {
      this.logger.error('Invalid token object provided');
      throw new BadRequestException('Token object is invalid');
    }

    try {
      this.logger.log(`Fetching price for token: ${token.symbol}`);
      const price = await this.priceApiService.fetchPrice(token.symbol.trim());
      if (price === null) {
        throw new TokenPriceError(`Price not found for token: ${token.symbol}`, token.symbol);
      }
      this.logger.log(`Successfully fetched price for token ${token.symbol}: ${price}`);
      return price;
    } catch (error) {
      if (error instanceof TokenPriceError) {
        this.logger.warn(`Custom error: ${error.message}`);
      } else {
        this.logger.error(`Unexpected error for token ${token.symbol}: ${error.message}`, error.stack);
      }
      throw error;
    }
  }
}
