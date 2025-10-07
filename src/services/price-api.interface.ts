export abstract class PriceApiInterface {
  abstract fetchPrice(symbol: string): Promise<number | null>;
}
