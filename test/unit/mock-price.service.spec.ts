import { Test, TestingModule } from '@nestjs/testing';
import { MockPriceService } from '../../src/services/mock-price.service';
import { PriceApiService } from '../../src/services/price-api.service';
import { Token } from '../../src/models/token.entity';

describe('MockPriceService', () => {
  let mockPriceService: MockPriceService;
  let priceApiService: PriceApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockPriceService,
        {
          provide: PriceApiService,
          useValue: {
            fetchPrice: jest.fn(),
          },
        },
      ],
    }).compile();

    mockPriceService = module.get<MockPriceService>(MockPriceService);
    priceApiService = module.get<PriceApiService>(PriceApiService);
  });

  it('should return price from API', async () => {
    jest.spyOn(priceApiService, 'fetchPrice').mockResolvedValue(100);

    const token: Token = { symbol: 'ETH' } as Token;
    const price = await mockPriceService.getPriceForToken(token);

    expect(price).toBe(100);
    expect(priceApiService.fetchPrice).toHaveBeenCalledWith('ETH');
  });

  it('should throw an error if price is not found', async () => {
    jest.spyOn(priceApiService, 'fetchPrice').mockResolvedValue(null);

    const token: Token = { symbol: 'UNKNOWN' } as Token;

    await expect(mockPriceService.getPriceForToken(token)).rejects.toThrow('Price not found for token: UNKNOWN');
    expect(priceApiService.fetchPrice).toHaveBeenCalledWith('UNKNOWN');
  });

  it('should log an error if API call fails', async () => {
    jest.spyOn(priceApiService, 'fetchPrice').mockRejectedValue(new Error('API error'));
    const loggerSpy = jest.spyOn(console, 'error').mockImplementation();

    const token: Token = { symbol: 'BTC' } as Token;

    await expect(mockPriceService.getPriceForToken(token)).rejects.toThrow('API error');
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to get price for token BTC'));
  });
});