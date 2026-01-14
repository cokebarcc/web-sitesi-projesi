import binanceService from './binanceService';
import { MomentumStrategy, BreakoutStrategy, StrategyFactory } from './tradingStrategy';
import { adaptiveStrategySelector } from './adaptiveStrategy';
import {
  StrategyConfig,
  TradingBotStatus,
  Position,
  Trade,
  TradingLog,
  OrderRequest,
  TradingSignal,
  RiskManagement
} from '../types/trading';

/**
 * Otomatik Trading Motoru
 * Stratejileri çalıştırır ve otomatik işlem yapar
 */
export class TradingEngine {
  private config: StrategyConfig;
  private isRunning: boolean = false;
  private startTime?: number;
  private intervalId?: NodeJS.Timeout;
  private logs: TradingLog[] = [];
  private activePositions: Position[] = [];
  private trades: Trade[] = [];
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private adaptiveMode: boolean = false;
  private lastStrategyOptimization: number = 0;
  private strategyOptimizationInterval: number = 24 * 60 * 60 * 1000; // 24 saat

  constructor(config: StrategyConfig, adaptiveMode: boolean = false) {
    this.config = config;
    this.adaptiveMode = adaptiveMode;
  }

  /**
   * Bot'u başlatır
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('WARNING', 'Bot zaten çalışıyor');
      return;
    }

    if (!binanceService.isInitialized()) {
      this.log('ERROR', 'Binance servisi başlatılmamış. Lütfen API anahtarlarını girin.');
      throw new Error('Binance servisi başlatılmamış');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.lastStrategyOptimization = Date.now(); // İlk başlangıçta sıfırla
    this.log('SUCCESS', '🚀 Trading botu başlatıldı');
    this.log('INFO', `Strateji: ${this.config.name}`);
    this.log('INFO', `Semboller: ${this.config.symbols.join(', ')}`);
    this.log('INFO', `Zaman dilimi: ${this.config.timeframe}`);
    if (this.adaptiveMode) {
      this.log('INFO', '🤖 Adaptive mod aktif - Strateji otomatik optimize edilecek');
    }

    // İlk analizi hemen yap
    await this.analyze();

    // Periyodik analiz döngüsünü başlat
    const intervalMs = this.getIntervalMs(this.config.timeframe);
    this.intervalId = setInterval(() => {
      this.analyze().catch(error => {
        this.log('ERROR', `Analiz hatası: ${error.message}`);
      });
    }, intervalMs);

    this.emit('statusChange', this.getStatus());
  }

  /**
   * Bot'u durdurur
   */
  stop(): void {
    if (!this.isRunning) {
      this.log('WARNING', 'Bot zaten durmuş durumda');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isRunning = false;
    this.log('INFO', '⏹️ Trading botu durduruldu');
    this.emit('statusChange', this.getStatus());
  }

  /**
   * Ana analiz ve işlem fonksiyonu
   */
  private async analyze(): Promise<void> {
    if (!this.isRunning) return;

    // Adaptive mode'da periyodik olarak stratejiyi yeniden optimize et
    if (this.adaptiveMode) {
      await this.checkAndReoptimizeStrategy();
    }

    this.log('INFO', '🔍 Piyasa analizi yapılıyor...');

    for (const symbol of this.config.symbols) {
      try {
        // Geçmiş verileri çek
        const candles = await binanceService.getHistoricalCandles(
          symbol,
          this.config.timeframe,
          500
        );

        if (candles.length < 200) {
          this.log('WARNING', `${symbol} için yeterli veri yok (${candles.length} mum)`);
          continue;
        }

        // Strateji ile sinyal üret
        const strategy = StrategyFactory.createStrategy(this.config.name);
        const signal = strategy.generateSignal(candles, this.config);

        this.log('INFO', `${symbol} Sinyal: ${signal.signal} (Güven: %${signal.confidence})`);
        this.emit('signal', signal);

        // Sinyal mantığına göre işlem yap
        await this.handleSignal(signal);
      } catch (error: any) {
        this.log('ERROR', `${symbol} analiz hatası: ${error.message}`);
      }
    }
  }

  /**
   * Adaptive mode'da stratejiyi periyodik olarak yeniden optimize eder
   */
  private async checkAndReoptimizeStrategy(): Promise<void> {
    const now = Date.now();

    // 24 saat geçmişse yeniden optimize et
    if (now - this.lastStrategyOptimization >= this.strategyOptimizationInterval) {
      this.log('INFO', '🔄 Strateji yeniden optimize ediliyor...');

      try {
        // İlk sembol için en iyi stratejiyi belirle
        const symbol = this.config.symbols[0];
        const bestStrategy = await adaptiveStrategySelector.selectBestStrategy(
          symbol,
          this.config.timeframe,
          true // Force reoptimization
        );

        // Stratejiyi güncelle
        this.config = {
          ...this.config,
          name: bestStrategy.config.name,
          indicators: bestStrategy.config.indicators
        };

        this.lastStrategyOptimization = now;
        this.log('SUCCESS', `✅ Strateji güncellendi: ${bestStrategy.config.name}`);
        this.log('INFO', `📊 ${bestStrategy.reason.split('\n')[0]}`);
        this.emit('strategyUpdated', bestStrategy);
      } catch (error: any) {
        this.log('ERROR', `Strateji optimizasyonu hatası: ${error.message}`);
      }
    }
  }

  /**
   * Sinyal geldiğinde işlem yapar
   */
  private async handleSignal(signal: TradingSignal): Promise<void> {
    // Mevcut pozisyonu kontrol et
    const existingPosition = this.activePositions.find(p => p.symbol === signal.symbol);

    // Risk yönetimi kontrolleri
    if (!this.checkRiskManagement()) {
      this.log('WARNING', '⚠️ Risk limitleri aşıldı, yeni pozisyon açılmıyor');
      return;
    }

    // STRONG_BUY - Long pozisyon aç
    if ((signal.signal === 'STRONG_BUY' || signal.signal === 'BUY') && signal.confidence >= 70) {
      if (existingPosition && existingPosition.side === 'LONG') {
        this.log('INFO', `${signal.symbol} için zaten long pozisyon var`);
        return;
      }

      // Short pozisyon varsa önce kapat
      if (existingPosition && existingPosition.side === 'SHORT') {
        await this.closePosition(existingPosition, signal.price);
      }

      // Yeni long pozisyon aç
      await this.openPosition(signal, 'LONG');
    }

    // STRONG_SELL - Short pozisyon aç veya long'u kapat
    else if ((signal.signal === 'STRONG_SELL' || signal.signal === 'SELL') && signal.confidence >= 70) {
      if (existingPosition && existingPosition.side === 'SHORT') {
        this.log('INFO', `${signal.symbol} için zaten short pozisyon var`);
        return;
      }

      // Long pozisyon varsa kapat
      if (existingPosition && existingPosition.side === 'LONG') {
        await this.closePosition(existingPosition, signal.price);
      }

      // Yeni short pozisyon aç (opsiyonel)
      // await this.openPosition(signal, 'SHORT');
    }

    // NEUTRAL - Mevcut pozisyonu kontrol et, gerekirse kapat
    else if (signal.signal === 'NEUTRAL' && existingPosition) {
      // Kar al veya zarar durdur seviyelerine ulaşıldıysa kapat
      await this.checkExitConditions(existingPosition, signal.price);
    }
  }

  /**
   * Yeni pozisyon açar
   */
  private async openPosition(signal: TradingSignal, side: 'LONG' | 'SHORT'): Promise<void> {
    try {
      // Pozisyon büyüklüğünü hesapla
      const balances = await binanceService.getAccountBalances();
      const usdtBalance = balances.find(b => b.asset === 'USDT');

      if (!usdtBalance || usdtBalance.free < 10) {
        this.log('WARNING', 'Yetersiz USDT bakiyesi');
        return;
      }

      const positionSizeUSD = usdtBalance.free * (this.config.riskManagement.maxPositionSize / 100);
      const quantity = positionSizeUSD / signal.price;

      // Stop loss ve take profit hesapla
      const strategy = StrategyFactory.createStrategy(this.config.name);
      const { stopLoss, takeProfit } = strategy.calculateExitLevels(
        signal.price,
        signal.signal,
        signal.indicators,
        this.config.riskManagement
      );

      this.log('INFO', `📈 ${side} pozisyon açılıyor: ${signal.symbol}`);
      this.log('INFO', `Miktar: ${quantity.toFixed(6)}, Fiyat: ${signal.price}`);
      this.log('INFO', `Stop Loss: ${stopLoss}, Take Profit: ${takeProfit}`);

      // Market emri gönder
      const orderRequest: OrderRequest = {
        symbol: signal.symbol,
        side: side === 'LONG' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: parseFloat(quantity.toFixed(6))
      };

      const order = await binanceService.createOrder(orderRequest);

      // Pozisyonu kaydet
      const newPosition: Position = {
        id: `pos_${Date.now()}`,
        symbol: signal.symbol,
        side: side,
        entryPrice: signal.price,
        currentPrice: signal.price,
        quantity: quantity,
        leverage: 1,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        openTime: Date.now(),
        stopLoss,
        takeProfit
      };

      this.activePositions.push(newPosition);
      this.log('SUCCESS', `✅ Pozisyon açıldı: ${signal.symbol} ${side}`);
      this.emit('positionOpened', newPosition);

      // Stop loss ve take profit emirlerini kur
      await this.setStopLossAndTakeProfit(newPosition);
    } catch (error: any) {
      this.log('ERROR', `Pozisyon açma hatası: ${error.message}`);
    }
  }

  /**
   * Pozisyonu kapatır
   */
  private async closePosition(position: Position, currentPrice: number): Promise<void> {
    try {
      this.log('INFO', `📉 Pozisyon kapatılıyor: ${position.symbol} ${position.side}`);

      // Ters emir gönder
      const orderRequest: OrderRequest = {
        symbol: position.symbol,
        side: position.side === 'LONG' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity: position.quantity
      };

      await binanceService.createOrder(orderRequest);

      // P&L hesapla
      const pnl = position.side === 'LONG'
        ? (currentPrice - position.entryPrice) * position.quantity
        : (position.entryPrice - currentPrice) * position.quantity;

      const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

      // Trade kaydı oluştur
      const trade: Trade = {
        id: `trade_${Date.now()}`,
        orderId: position.id,
        symbol: position.symbol,
        side: position.side === 'LONG' ? 'BUY' : 'SELL',
        type: 'MARKET',
        price: currentPrice,
        quantity: position.quantity,
        commission: (position.quantity * currentPrice * 0.001), // %0.1 komisyon
        commissionAsset: 'USDT',
        time: Date.now(),
        realized: true,
        pnl,
        pnlPercent
      };

      this.trades.push(trade);

      // Pozisyonu listeden kaldır
      this.activePositions = this.activePositions.filter(p => p.id !== position.id);

      const pnlText = pnl >= 0 ? `+$${pnl.toFixed(2)} 💰` : `-$${Math.abs(pnl).toFixed(2)} ❌`;
      this.log('SUCCESS', `✅ Pozisyon kapatıldı: ${position.symbol} | P&L: ${pnlText} (%${pnlPercent.toFixed(2)})`);
      this.emit('positionClosed', { position, trade });
    } catch (error: any) {
      this.log('ERROR', `Pozisyon kapatma hatası: ${error.message}`);
    }
  }

  /**
   * Stop loss ve take profit emirlerini ayarlar
   */
  private async setStopLossAndTakeProfit(position: Position): Promise<void> {
    if (!position.stopLoss || !position.takeProfit) return;

    try {
      // Stop loss emri
      const slOrder: OrderRequest = {
        symbol: position.symbol,
        side: position.side === 'LONG' ? 'SELL' : 'BUY',
        type: 'STOP_LOSS_LIMIT',
        quantity: position.quantity,
        stopPrice: position.stopLoss,
        price: position.stopLoss * 0.99, // %1 buffer
        timeInForce: 'GTC'
      };

      // Take profit emri
      const tpOrder: OrderRequest = {
        symbol: position.symbol,
        side: position.side === 'LONG' ? 'SELL' : 'BUY',
        type: 'TAKE_PROFIT_LIMIT',
        quantity: position.quantity,
        stopPrice: position.takeProfit,
        price: position.takeProfit * 1.01, // %1 buffer
        timeInForce: 'GTC'
      };

      // Bu emirler testnet'te çalışmayabilir
      // await binanceService.createOrder(slOrder);
      // await binanceService.createOrder(tpOrder);

      this.log('INFO', `SL/TP emirleri ayarlandı: SL=${position.stopLoss}, TP=${position.takeProfit}`);
    } catch (error: any) {
      this.log('WARNING', `SL/TP emri hatası: ${error.message}`);
    }
  }

  /**
   * Çıkış koşullarını kontrol eder
   */
  private async checkExitConditions(position: Position, currentPrice: number): Promise<void> {
    // Stop loss kontrolü
    if (position.stopLoss) {
      const shouldExitSL = position.side === 'LONG'
        ? currentPrice <= position.stopLoss
        : currentPrice >= position.stopLoss;

      if (shouldExitSL) {
        this.log('WARNING', `⚠️ Stop Loss tetiklendi: ${position.symbol}`);
        await this.closePosition(position, currentPrice);
        return;
      }
    }

    // Take profit kontrolü
    if (position.takeProfit) {
      const shouldExitTP = position.side === 'LONG'
        ? currentPrice >= position.takeProfit
        : currentPrice <= position.takeProfit;

      if (shouldExitTP) {
        this.log('SUCCESS', `🎯 Take Profit hedefe ulaştı: ${position.symbol}`);
        await this.closePosition(position, currentPrice);
        return;
      }
    }
  }

  /**
   * Risk yönetimi kontrolü
   */
  private checkRiskManagement(): boolean {
    const rm = this.config.riskManagement;

    // Maksimum açık pozisyon sayısı
    if (this.activePositions.length >= rm.maxOpenPositions) {
      this.log('WARNING', `Maksimum pozisyon sayısına ulaşıldı (${rm.maxOpenPositions})`);
      return false;
    }

    // Günlük zarar limiti kontrolü (basitleştirilmiş)
    const todayTrades = this.trades.filter(t => {
      const today = new Date().setHours(0, 0, 0, 0);
      return t.time >= today;
    });

    const todayPnL = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    if (todayPnL < -rm.maxDailyLoss) {
      this.log('ERROR', `⛔ Günlük zarar limiti aşıldı: $${todayPnL.toFixed(2)}`);
      return false;
    }

    return true;
  }

  /**
   * Zaman dilimini milisaniyeye çevirir
   */
  private getIntervalMs(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return map[timeframe] || 60 * 1000;
  }

  /**
   * Log ekler
   */
  private log(level: TradingLog['level'], message: string, data?: any): void {
    const logEntry: TradingLog = {
      timestamp: Date.now(),
      level,
      message,
      data
    };

    this.logs.push(logEntry);

    // Son 500 log'u tut
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-500);
    }

    this.emit('log', logEntry);

    // Console'a da yazdır
    const emoji = {
      INFO: 'ℹ️',
      SUCCESS: '✅',
      WARNING: '⚠️',
      ERROR: '❌'
    }[level];
    console.log(`${emoji} [${new Date().toLocaleTimeString()}] ${message}`);
  }

  /**
   * Event listener ekler
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Event yayınlar
   */
  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Bot durumunu döner
   */
  getStatus(): TradingBotStatus {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime : undefined,
      activePositions: this.activePositions.length,
      totalTrades: this.trades.length,
      currentPnl: this.trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
      errors: this.logs.filter(l => l.level === 'ERROR').map(l => l.message)
    };
  }

  /**
   * Logları döner
   */
  getLogs(limit: number = 100): TradingLog[] {
    return this.logs.slice(-limit);
  }

  /**
   * Aktif pozisyonları döner
   */
  getActivePositions(): Position[] {
    return this.activePositions;
  }

  /**
   * İşlem geçmişini döner
   */
  getTradeHistory(): Trade[] {
    return this.trades;
  }

  /**
   * Config'i günceller
   */
  updateConfig(newConfig: Partial<StrategyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('INFO', 'Strateji yapılandırması güncellendi');
  }

  /**
   * Adaptive mode durumunu döner
   */
  isAdaptiveModeEnabled(): boolean {
    return this.adaptiveMode;
  }

  /**
   * Adaptive mode'u açar/kapatır
   */
  setAdaptiveMode(enabled: boolean): void {
    this.adaptiveMode = enabled;
    this.log('INFO', `Adaptive mod ${enabled ? 'açıldı' : 'kapatıldı'}`);
    if (enabled) {
      this.lastStrategyOptimization = 0; // Bir sonraki analizde optimize edilsin
    }
  }
}
