import binanceService from './binanceService';
import { MomentumStrategy, BreakoutStrategy } from './tradingStrategy';
import { RiskManager } from './riskManagement';
import {
  CandlestickData,
  StrategyConfig,
  Trade,
  TradingStats,
  BacktestResult,
  Position,
  SignalStrength
} from '../types/trading';

/**
 * Backtesting Servisi
 * Geçmiş verilerle stratejileri test eder ve performanslarını karşılaştırır
 */
export class BacktestingService {
  /**
   * Tek bir stratejiyi backtest eder
   */
  async runBacktest(
    candles: CandlestickData[],
    config: StrategyConfig,
    initialBalance: number = 10000
  ): Promise<BacktestResult> {
    const strategy = config.name === 'momentum'
      ? new MomentumStrategy()
      : new BreakoutStrategy();

    let balance = initialBalance;
    let position: Position | null = null;
    const trades: Trade[] = [];
    const equityCurve: { timestamp: number; balance: number }[] = [];
    const drawdownCurve: { timestamp: number; drawdown: number }[] = [];

    console.log(`🔄 Backtesting başlatılıyor: ${config.name} (${candles.length} mum)`);

    // Her mum için iterasyon
    for (let i = 200; i < candles.length; i++) {
      const historicalData = candles.slice(0, i + 1);
      const currentCandle = candles[i];

      // Strateji sinyali üret
      const signal = strategy.generateSignal(historicalData, config);

      // Eğer pozisyon varsa, çıkış koşullarını kontrol et
      if (position) {
        const { stopLoss, takeProfit } = strategy.calculateExitLevels(
          position.entryPrice,
          signal.signal,
          signal.indicators,
          config.riskManagement
        );

        // Stop loss veya take profit kontrolü
        const shouldExit =
          (position.side === 'LONG' && (
            currentCandle.low <= stopLoss ||
            currentCandle.high >= takeProfit
          )) ||
          (position.side === 'SHORT' && (
            currentCandle.high >= stopLoss ||
            currentCandle.low <= takeProfit
          ));

        if (shouldExit) {
          // Pozisyonu kapat
          const exitPrice = position.side === 'LONG'
            ? (currentCandle.low <= stopLoss ? stopLoss : takeProfit)
            : (currentCandle.high >= stopLoss ? stopLoss : takeProfit);

          const pnl = position.side === 'LONG'
            ? (exitPrice - position.entryPrice) * position.quantity
            : (position.entryPrice - exitPrice) * position.quantity;

          const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

          balance += pnl;

          trades.push({
            id: `trade_${trades.length}`,
            orderId: position.id,
            symbol: config.symbols[0],
            side: position.side === 'LONG' ? 'SELL' : 'BUY',
            type: 'MARKET',
            price: exitPrice,
            quantity: position.quantity,
            commission: exitPrice * position.quantity * 0.001,
            commissionAsset: 'USDT',
            time: currentCandle.openTime,
            realized: true,
            pnl,
            pnlPercent
          });

          position = null;
        }
      }

      // Yeni pozisyon açma sinyali
      if (!position && signal.confidence >= 70) {
        if (signal.signal === 'STRONG_BUY' || signal.signal === 'BUY') {
          // Long pozisyon aç
          const positionSize = balance * (config.riskManagement.maxPositionSize / 100);
          const quantity = positionSize / currentCandle.close;

          position = {
            id: `pos_${i}`,
            symbol: config.symbols[0],
            side: 'LONG',
            entryPrice: currentCandle.close,
            currentPrice: currentCandle.close,
            quantity,
            leverage: 1,
            unrealizedPnl: 0,
            unrealizedPnlPercent: 0,
            openTime: currentCandle.openTime
          };

          trades.push({
            id: `trade_${trades.length}`,
            orderId: position.id,
            symbol: config.symbols[0],
            side: 'BUY',
            type: 'MARKET',
            price: currentCandle.close,
            quantity,
            commission: currentCandle.close * quantity * 0.001,
            commissionAsset: 'USDT',
            time: currentCandle.openTime,
            realized: false
          });
        } else if (signal.signal === 'STRONG_SELL' || signal.signal === 'SELL') {
          // Short pozisyon aç (basitleştirilmiş - long kapama gibi davran)
          // Gerçek short için futures API gerekir
        }
      }

      // Equity curve güncelle
      const currentEquity = position
        ? balance + (position.side === 'LONG'
            ? (currentCandle.close - position.entryPrice) * position.quantity
            : (position.entryPrice - currentCandle.close) * position.quantity)
        : balance;

      equityCurve.push({
        timestamp: currentCandle.openTime,
        balance: currentEquity
      });

      // Drawdown hesapla
      const peak = Math.max(...equityCurve.map(e => e.balance));
      const drawdown = ((peak - currentEquity) / peak) * 100;
      drawdownCurve.push({
        timestamp: currentCandle.openTime,
        drawdown
      });
    }

    // Açık pozisyon varsa kapat
    if (position) {
      const lastCandle = candles[candles.length - 1];
      const pnl = position.side === 'LONG'
        ? (lastCandle.close - position.entryPrice) * position.quantity
        : (position.entryPrice - lastCandle.close) * position.quantity;

      balance += pnl;

      trades.push({
        id: `trade_${trades.length}`,
        orderId: position.id,
        symbol: config.symbols[0],
        side: position.side === 'LONG' ? 'SELL' : 'BUY',
        type: 'MARKET',
        price: lastCandle.close,
        quantity: position.quantity,
        commission: lastCandle.close * position.quantity * 0.001,
        commissionAsset: 'USDT',
        time: lastCandle.openTime,
        realized: true,
        pnl,
        pnlPercent: (pnl / (position.entryPrice * position.quantity)) * 100
      });
    }

    const stats = RiskManager.calculateTradingStats(trades);
    const totalReturn = balance - initialBalance;
    const totalReturnPercent = (totalReturn / initialBalance) * 100;

    console.log(`✅ Backtesting tamamlandı: ${trades.length} işlem, %${totalReturnPercent.toFixed(2)} getiri`);

    return {
      startDate: candles[0].openTime,
      endDate: candles[candles.length - 1].openTime,
      initialBalance,
      finalBalance: balance,
      totalReturn,
      totalReturnPercent,
      trades,
      stats,
      equityCurve,
      drawdownCurve
    };
  }

  /**
   * Birden fazla stratejiyi karşılaştırır
   */
  async compareStrategies(
    symbol: string,
    timeframe: string,
    lookbackDays: number = 90
  ): Promise<{ strategy: string; result: BacktestResult }[]> {
    console.log(`📊 Strateji karşılaştırması başlatılıyor: ${symbol} (${lookbackDays} gün)`);

    // Geçmiş verileri çek
    const candleCount = this.getCandleCount(timeframe, lookbackDays);
    const candles = await binanceService.getHistoricalCandles(symbol, timeframe, candleCount);

    const strategies = ['momentum', 'breakout'];
    const results: { strategy: string; result: BacktestResult }[] = [];

    for (const strategyName of strategies) {
      const config: StrategyConfig = {
        name: strategyName,
        enabled: true,
        symbols: [symbol],
        timeframe: timeframe as any,
        indicators: {
          rsi: { period: 14, overbought: 70, oversold: 30 },
          macd: { fast: 12, slow: 26, signal: 9 },
          ema: { periods: [9, 21, 50, 200] },
          bollinger: { period: 20, stdDev: 2 },
          atr: { period: 14 }
        },
        entryConditions: [],
        exitConditions: [],
        riskManagement: RiskManager.getDefaultRiskManagement()
      };

      const result = await this.runBacktest(candles, config, 10000);
      results.push({ strategy: strategyName, result });

      console.log(`${strategyName}: %${result.totalReturnPercent.toFixed(2)} getiri, ${result.stats.winRate.toFixed(1)}% kazanma oranı`);
    }

    return results;
  }

  /**
   * Parametre optimizasyonu yapar
   */
  async optimizeParameters(
    symbol: string,
    timeframe: string,
    strategyName: string,
    lookbackDays: number = 90
  ): Promise<{
    bestConfig: StrategyConfig;
    bestResult: BacktestResult;
    allResults: { config: StrategyConfig; result: BacktestResult }[];
  }> {
    console.log(`⚙️ Parametre optimizasyonu başlatılıyor: ${strategyName}`);

    const candleCount = this.getCandleCount(timeframe, lookbackDays);
    const candles = await binanceService.getHistoricalCandles(symbol, timeframe, candleCount);

    // RSI parametre kombinasyonları
    const rsiPeriods = [10, 14, 20];
    const rsiOverbought = [65, 70, 75];
    const rsiOversold = [25, 30, 35];

    // MACD parametre kombinasyonları
    const macdFast = [8, 12, 16];
    const macdSlow = [21, 26, 30];

    const allResults: { config: StrategyConfig; result: BacktestResult }[] = [];
    let bestResult: BacktestResult | null = null;
    let bestConfig: StrategyConfig | null = null;

    // Grid search - tüm kombinasyonları dene
    for (const rsiPer of rsiPeriods) {
      for (const rsiOB of rsiOverbought) {
        for (const rsiOS of rsiOversold) {
          for (const fast of macdFast) {
            for (const slow of macdSlow) {
              const config: StrategyConfig = {
                name: strategyName,
                enabled: true,
                symbols: [symbol],
                timeframe: timeframe as any,
                indicators: {
                  rsi: { period: rsiPer, overbought: rsiOB, oversold: rsiOS },
                  macd: { fast, slow, signal: 9 },
                  ema: { periods: [9, 21, 50, 200] },
                  bollinger: { period: 20, stdDev: 2 },
                  atr: { period: 14 }
                },
                entryConditions: [],
                exitConditions: [],
                riskManagement: RiskManager.getDefaultRiskManagement()
              };

              const result = await this.runBacktest(candles, config, 10000);
              allResults.push({ config, result });

              // En iyi sonucu bul (Sharpe Ratio bazlı)
              if (!bestResult || result.stats.sharpeRatio > bestResult.stats.sharpeRatio) {
                bestResult = result;
                bestConfig = config;
              }
            }
          }
        }
      }
    }

    console.log(`✅ Optimizasyon tamamlandı: ${allResults.length} kombinasyon test edildi`);
    console.log(`En iyi parametre seti: Sharpe Ratio ${bestResult!.stats.sharpeRatio.toFixed(2)}`);

    return {
      bestConfig: bestConfig!,
      bestResult: bestResult!,
      allResults
    };
  }

  /**
   * Zaman dilimine göre mum sayısını hesaplar
   */
  private getCandleCount(timeframe: string, days: number): number {
    const hoursPerDay = 24;
    const totalHours = days * hoursPerDay;

    const intervalHours: Record<string, number> = {
      '1m': 1 / 60,
      '5m': 5 / 60,
      '15m': 15 / 60,
      '1h': 1,
      '4h': 4,
      '1d': 24
    };

    return Math.min(Math.floor(totalHours / intervalHours[timeframe]), 1000);
  }

  /**
   * Walk-forward optimizasyonu - daha gerçekçi backtesting
   */
  async walkForwardOptimization(
    symbol: string,
    timeframe: string,
    strategyName: string,
    totalDays: number = 180,
    optimizationWindow: number = 60,
    testWindow: number = 30
  ): Promise<{
    results: BacktestResult[];
    avgReturn: number;
    avgSharpe: number;
  }> {
    console.log(`🚶 Walk-forward optimizasyonu başlatılıyor...`);

    const results: BacktestResult[] = [];
    let currentDay = 0;

    while (currentDay + optimizationWindow + testWindow <= totalDays) {
      // Optimizasyon periyodu
      const optCandles = await this.getCandlesForDays(
        symbol,
        timeframe,
        currentDay,
        optimizationWindow
      );

      // En iyi parametreleri bul
      const { bestConfig } = await this.optimizeParametersOnData(
        optCandles,
        strategyName
      );

      // Test periyodu
      const testCandles = await this.getCandlesForDays(
        symbol,
        timeframe,
        currentDay + optimizationWindow,
        testWindow
      );

      // Optimize edilmiş parametrelerle test et
      const testResult = await this.runBacktest(testCandles, bestConfig, 10000);
      results.push(testResult);

      console.log(`Dönem ${results.length}: %${testResult.totalReturnPercent.toFixed(2)} getiri`);

      currentDay += testWindow;
    }

    const avgReturn = results.reduce((sum, r) => sum + r.totalReturnPercent, 0) / results.length;
    const avgSharpe = results.reduce((sum, r) => sum + r.stats.sharpeRatio, 0) / results.length;

    console.log(`✅ Walk-forward tamamlandı: Ort. %${avgReturn.toFixed(2)} getiri, Ort. Sharpe ${avgSharpe.toFixed(2)}`);

    return { results, avgReturn, avgSharpe };
  }

  private async getCandlesForDays(
    symbol: string,
    timeframe: string,
    startDay: number,
    days: number
  ): Promise<CandlestickData[]> {
    const count = this.getCandleCount(timeframe, days);
    // Basitleştirilmiş - gerçekte belirli tarih aralığı için çekilmeli
    return await binanceService.getHistoricalCandles(symbol, timeframe, count);
  }

  private async optimizeParametersOnData(
    candles: CandlestickData[],
    strategyName: string
  ): Promise<{ bestConfig: StrategyConfig; bestResult: BacktestResult }> {
    // Basitleştirilmiş optimizasyon - sadece birkaç kombinasyon
    const configs = this.generateConfigCombinations(strategyName);
    let bestResult: BacktestResult | null = null;
    let bestConfig: StrategyConfig | null = null;

    for (const config of configs) {
      const result = await this.runBacktest(candles, config, 10000);
      if (!bestResult || result.stats.sharpeRatio > bestResult.stats.sharpeRatio) {
        bestResult = result;
        bestConfig = config;
      }
    }

    return { bestConfig: bestConfig!, bestResult: bestResult! };
  }

  private generateConfigCombinations(strategyName: string): StrategyConfig[] {
    // Basitleştirilmiş - sadece 3 kombinasyon
    return [
      {
        name: strategyName,
        enabled: true,
        symbols: ['BTCUSDT'],
        timeframe: '1h',
        indicators: {
          rsi: { period: 14, overbought: 70, oversold: 30 },
          macd: { fast: 12, slow: 26, signal: 9 },
          ema: { periods: [9, 21, 50, 200] },
          bollinger: { period: 20, stdDev: 2 },
          atr: { period: 14 }
        },
        entryConditions: [],
        exitConditions: [],
        riskManagement: RiskManager.getDefaultRiskManagement()
      }
    ];
  }
}

export const backtestingService = new BacktestingService();
