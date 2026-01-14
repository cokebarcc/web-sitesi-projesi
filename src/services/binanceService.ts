import Binance from 'binance-api-node';
import {
  TradingConfig,
  CandlestickData,
  OrderRequest,
  Position,
  AccountBalance,
  MarketData,
  Trade
} from '../types/trading';

class BinanceService {
  private client: any;
  private isTestnet: boolean = false;

  constructor(config?: TradingConfig) {
    if (config) {
      this.initialize(config);
    }
  }

  initialize(config: TradingConfig) {
    this.isTestnet = config.testnet || false;

    this.client = Binance({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      // Testnet için farklı endpoint kullanılabilir
      ...(this.isTestnet && {
        httpBase: 'https://testnet.binance.vision',
        wsBase: 'wss://testnet.binance.vision/ws'
      })
    });

    console.log(`✅ Binance ${this.isTestnet ? 'Testnet' : 'Live'} bağlantısı kuruldu`);
  }

  isInitialized(): boolean {
    return !!this.client;
  }

  /**
   * Geçmiş mum verilerini (candlestick) çeker
   */
  async getHistoricalCandles(
    symbol: string,
    interval: string = '1h',
    limit: number = 500
  ): Promise<CandlestickData[]> {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış. Önce API anahtarlarını ayarlayın.');
    }

    try {
      const candles = await this.client.candles({
        symbol,
        interval,
        limit
      });

      return candles.map((c: any) => ({
        openTime: c.openTime,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.volume),
        closeTime: c.closeTime,
        trades: c.trades
      }));
    } catch (error: any) {
      console.error('❌ Geçmiş veri çekme hatası:', error);
      throw new Error(`Binance API hatası: ${error.message}`);
    }
  }

  /**
   * Gerçek zamanlı fiyat bilgisi
   */
  async getCurrentPrice(symbol: string): Promise<number> {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    try {
      const ticker = await this.client.prices({ symbol });
      return parseFloat(ticker[symbol]);
    } catch (error: any) {
      console.error('❌ Fiyat çekme hatası:', error);
      throw new Error(`Fiyat alınamadı: ${error.message}`);
    }
  }

  /**
   * Market verilerini getirir (24h değişim, hacim vb.)
   */
  async getMarketData(symbol: string): Promise<MarketData> {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    try {
      const ticker = await this.client.dailyStats({ symbol });

      return {
        symbol,
        price: parseFloat(ticker.lastPrice),
        priceChange24h: parseFloat(ticker.priceChange),
        priceChangePercent24h: parseFloat(ticker.priceChangePercent),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice),
        volume24h: parseFloat(ticker.volume),
        quoteVolume24h: parseFloat(ticker.quoteVolume),
        lastUpdate: Date.now()
      };
    } catch (error: any) {
      console.error('❌ Market verisi çekme hatası:', error);
      throw new Error(`Market verisi alınamadı: ${error.message}`);
    }
  }

  /**
   * Hesap bakiyelerini getirir
   */
  async getAccountBalances(): Promise<AccountBalance[]> {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    try {
      const accountInfo = await this.client.accountInfo();
      const balances: AccountBalance[] = [];

      // Sadece bakiyesi olan varlıkları göster
      for (const balance of accountInfo.balances) {
        const free = parseFloat(balance.free);
        const locked = parseFloat(balance.locked);
        const total = free + locked;

        if (total > 0) {
          // USD değerini hesapla (basit yaklaşım)
          let usdValue = 0;
          if (balance.asset === 'USDT' || balance.asset === 'BUSD') {
            usdValue = total;
          } else {
            try {
              const price = await this.getCurrentPrice(`${balance.asset}USDT`);
              usdValue = total * price;
            } catch {
              // Eğer fiyat bulunamazsa 0 olarak bırak
              usdValue = 0;
            }
          }

          balances.push({
            asset: balance.asset,
            free,
            locked,
            total,
            usdValue
          });
        }
      }

      return balances.sort((a, b) => b.usdValue - a.usdValue);
    } catch (error: any) {
      console.error('❌ Bakiye çekme hatası:', error);
      throw new Error(`Bakiye alınamadı: ${error.message}`);
    }
  }

  /**
   * Açık pozisyonları getirir (Futures için)
   */
  async getOpenPositions(): Promise<Position[]> {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    try {
      // Futures pozisyonları
      const positions = await this.client.futuresPositionRisk();
      const openPositions: Position[] = [];

      for (const pos of positions) {
        const positionAmt = parseFloat(pos.positionAmt);

        if (positionAmt !== 0) {
          const entryPrice = parseFloat(pos.entryPrice);
          const markPrice = parseFloat(pos.markPrice);
          const unrealizedPnl = parseFloat(pos.unRealizedProfit);
          const leverage = parseInt(pos.leverage);

          openPositions.push({
            id: pos.symbol,
            symbol: pos.symbol,
            side: positionAmt > 0 ? 'LONG' : 'SHORT',
            entryPrice,
            currentPrice: markPrice,
            quantity: Math.abs(positionAmt),
            leverage,
            unrealizedPnl,
            unrealizedPnlPercent: (unrealizedPnl / (entryPrice * Math.abs(positionAmt))) * 100,
            liquidationPrice: parseFloat(pos.liquidationPrice),
            openTime: Date.now() // API'den alınamıyor, yaklaşık değer
          });
        }
      }

      return openPositions;
    } catch (error: any) {
      console.error('❌ Pozisyon bilgisi hatası:', error);
      // Futures aktif değilse boş array dön
      return [];
    }
  }

  /**
   * Emir oluşturur
   */
  async createOrder(orderRequest: OrderRequest): Promise<any> {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    if (this.isTestnet) {
      console.log('⚠️ TESTNET MODU - Gerçek işlem yapılmıyor:', orderRequest);
      return {
        simulated: true,
        ...orderRequest,
        orderId: Date.now(),
        status: 'FILLED',
        executedQty: orderRequest.quantity
      };
    }

    try {
      const order = await this.client.order({
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type,
        quantity: orderRequest.quantity.toString(),
        price: orderRequest.price?.toString(),
        stopPrice: orderRequest.stopPrice?.toString(),
        timeInForce: orderRequest.timeInForce
      });

      console.log('✅ Emir oluşturuldu:', order);
      return order;
    } catch (error: any) {
      console.error('❌ Emir oluşturma hatası:', error);
      throw new Error(`Emir oluşturulamadı: ${error.message}`);
    }
  }

  /**
   * Açık emirleri getirir
   */
  async getOpenOrders(symbol?: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    try {
      const orders = await this.client.openOrders({ symbol });
      return orders;
    } catch (error: any) {
      console.error('❌ Açık emir getirme hatası:', error);
      return [];
    }
  }

  /**
   * Emri iptal eder
   */
  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    try {
      const result = await this.client.cancelOrder({
        symbol,
        orderId
      });

      console.log('✅ Emir iptal edildi:', result);
      return result;
    } catch (error: any) {
      console.error('❌ Emir iptal hatası:', error);
      throw new Error(`Emir iptal edilemedi: ${error.message}`);
    }
  }

  /**
   * Tüm açık emirleri iptal eder
   */
  async cancelAllOrders(symbol: string): Promise<any> {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    try {
      const result = await this.client.cancelOpenOrders({ symbol });
      console.log('✅ Tüm emirler iptal edildi:', result);
      return result;
    } catch (error: any) {
      console.error('❌ Toplu iptal hatası:', error);
      throw new Error(`Emirler iptal edilemedi: ${error.message}`);
    }
  }

  /**
   * İşlem geçmişini getirir
   */
  async getTradeHistory(symbol: string, limit: number = 100): Promise<Trade[]> {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    try {
      const trades = await this.client.myTrades({ symbol, limit });

      return trades.map((t: any) => ({
        id: t.id.toString(),
        orderId: t.orderId.toString(),
        symbol: t.symbol,
        side: t.isBuyer ? 'BUY' : 'SELL',
        type: 'MARKET',
        price: parseFloat(t.price),
        quantity: parseFloat(t.qty),
        commission: parseFloat(t.commission),
        commissionAsset: t.commissionAsset,
        time: t.time,
        realized: true
      }));
    } catch (error: any) {
      console.error('❌ İşlem geçmişi hatası:', error);
      return [];
    }
  }

  /**
   * WebSocket ile gerçek zamanlı fiyat takibi
   */
  subscribeToPrice(symbol: string, callback: (price: number) => void): () => void {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    const clean = this.client.ws.ticker(symbol, (ticker: any) => {
      callback(parseFloat(ticker.curDayClose));
    });

    return clean;
  }

  /**
   * WebSocket ile gerçek zamanlı mum verisi
   */
  subscribeToCandles(
    symbol: string,
    interval: string,
    callback: (candle: CandlestickData) => void
  ): () => void {
    if (!this.client) {
      throw new Error('Binance client başlatılmamış');
    }

    const clean = this.client.ws.candles(symbol, interval, (candle: any) => {
      callback({
        openTime: candle.startTime,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
        closeTime: candle.closeTime,
        trades: candle.trades
      });
    });

    return clean;
  }
}

// Singleton instance
export const binanceService = new BinanceService();
export default binanceService;
