import { backtestingService } from './backtestingService';
import { StrategyConfig, BacktestResult } from '../types/trading';
import { RiskManager } from './riskManagement';

/**
 * Adaptive Strateji Seçici
 * Geçmiş verilere göre en iyi performans gösteren stratejiyi otomatik seçer
 */
export class AdaptiveStrategySelector {
  private lastOptimization: number = 0;
  private optimizationInterval: number = 24 * 60 * 60 * 1000; // 24 saat
  private currentBestStrategy: StrategyConfig | null = null;
  private performanceHistory: Map<string, number[]> = new Map();

  /**
   * En iyi stratejiyi belirler
   */
  async selectBestStrategy(
    symbol: string,
    timeframe: string,
    forceReoptimize: boolean = false
  ): Promise<{
    config: StrategyConfig;
    reason: string;
    backtest: BacktestResult;
  }> {
    const now = Date.now();

    // Önbelleği kontrol et
    if (
      !forceReoptimize &&
      this.currentBestStrategy &&
      now - this.lastOptimization < this.optimizationInterval
    ) {
      console.log('✅ Önbellekten strateji kullanılıyor');
      return {
        config: this.currentBestStrategy,
        reason: 'Önbellekten yüklendi (son 24 saat içinde optimize edildi)',
        backtest: {} as BacktestResult // Gerçekte cache'lenmeli
      };
    }

    console.log('🔍 En iyi strateji belirleniyor...');

    // Stratejileri karşılaştır
    const comparisonResults = await backtestingService.compareStrategies(
      symbol,
      timeframe,
      90 // Son 90 gün
    );

    // Performans metriklerine göre sırala
    const ranked = comparisonResults.sort((a, b) => {
      // Sharpe ratio'yu önceliklendir
      const sharpeWeight = 0.4;
      const returnWeight = 0.3;
      const winRateWeight = 0.2;
      const drawdownWeight = 0.1;

      const scoreA =
        a.result.stats.sharpeRatio * sharpeWeight +
        a.result.totalReturnPercent * returnWeight +
        a.result.stats.winRate * winRateWeight -
        a.result.stats.maxDrawdown * drawdownWeight;

      const scoreB =
        b.result.stats.sharpeRatio * sharpeWeight +
        b.result.totalReturnPercent * returnWeight +
        b.result.stats.winRate * winRateWeight -
        b.result.stats.maxDrawdown * drawdownWeight;

      return scoreB - scoreA;
    });

    const bestStrategy = ranked[0];

    // Performans geçmişini güncelle
    const strategyName = bestStrategy.strategy;
    if (!this.performanceHistory.has(strategyName)) {
      this.performanceHistory.set(strategyName, []);
    }
    this.performanceHistory.get(strategyName)!.push(bestStrategy.result.stats.sharpeRatio);

    // En iyi stratejinin konfigürasyonunu oluştur
    this.currentBestStrategy = {
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

    this.lastOptimization = now;

    const reason = this.buildReasonText(bestStrategy, ranked);

    console.log(`✅ En iyi strateji: ${strategyName}`);
    console.log(`   Sharpe Ratio: ${bestStrategy.result.stats.sharpeRatio.toFixed(2)}`);
    console.log(`   Getiri: %${bestStrategy.result.totalReturnPercent.toFixed(2)}`);
    console.log(`   Kazanma Oranı: %${bestStrategy.result.stats.winRate.toFixed(1)}`);

    return {
      config: this.currentBestStrategy,
      reason,
      backtest: bestStrategy.result
    };
  }

  /**
   * Parametreleri optimize eder
   */
  async optimizeStrategyParameters(
    symbol: string,
    timeframe: string,
    strategyName: string
  ): Promise<{
    config: StrategyConfig;
    improvement: number;
    details: string;
  }> {
    console.log(`⚙️ ${strategyName} parametreleri optimize ediliyor...`);

    const optimization = await backtestingService.optimizeParameters(
      symbol,
      timeframe,
      strategyName,
      90
    );

    // Varsayılan parametrelerle karşılaştır
    const defaultConfig: StrategyConfig = {
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

    const defaultBacktest = await backtestingService.runBacktest(
      await this.getCandles(symbol, timeframe, 90),
      defaultConfig,
      10000
    );

    const improvement =
      ((optimization.bestResult.stats.sharpeRatio - defaultBacktest.stats.sharpeRatio) /
        Math.abs(defaultBacktest.stats.sharpeRatio)) *
      100;

    const details = `
Optimize Edilmiş Parametreler:
- RSI Periyot: ${optimization.bestConfig.indicators.rsi.period}
- RSI Aşırı Alım: ${optimization.bestConfig.indicators.rsi.overbought}
- RSI Aşırı Satım: ${optimization.bestConfig.indicators.rsi.oversold}
- MACD Fast: ${optimization.bestConfig.indicators.macd.fast}
- MACD Slow: ${optimization.bestConfig.indicators.macd.slow}

Performans İyileştirmesi: %${improvement.toFixed(2)}
Sharpe Ratio: ${defaultBacktest.stats.sharpeRatio.toFixed(2)} → ${optimization.bestResult.stats.sharpeRatio.toFixed(2)}
Kazanma Oranı: %${defaultBacktest.winRate.toFixed(1)} → %${optimization.bestResult.stats.winRate.toFixed(1)}
    `.trim();

    this.currentBestStrategy = optimization.bestConfig;

    return {
      config: optimization.bestConfig,
      improvement,
      details
    };
  }

  /**
   * Piyasa koşullarını analiz eder
   */
  async analyzeMarketConditions(
    symbol: string,
    timeframe: string
  ): Promise<{
    condition: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CALM';
    recommendation: string;
    confidence: number;
  }> {
    const candles = await this.getCandles(symbol, timeframe, 30);

    // Trend analizi - EMA eğilimine bak
    const closes = candles.map(c => c.close);
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);

    const isTrending = Math.abs(ema20[ema20.length - 1] - ema50[ema50.length - 1]) >
      ema20[ema20.length - 1] * 0.02; // %2 fark varsa trending

    // Volatilite analizi - ATR
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const atr = this.calculateATR(highs, lows, closes, 14);
    const currentATR = atr[atr.length - 1];
    const avgATR = atr.reduce((a, b) => a + b, 0) / atr.length;
    const isVolatile = currentATR > avgATR * 1.5;

    let condition: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CALM';
    let recommendation: string;
    let confidence: number;

    if (isTrending && isVolatile) {
      condition = 'TRENDING';
      recommendation = 'Momentum stratejisi önerilir. Güçlü trendler var.';
      confidence = 85;
    } else if (isTrending && !isVolatile) {
      condition = 'TRENDING';
      recommendation = 'Momentum stratejisi önerilir. Stabil trend mevcut.';
      confidence = 75;
    } else if (!isTrending && isVolatile) {
      condition = 'VOLATILE';
      recommendation = 'Breakout stratejisi önerilir. Yüksek volatilite var.';
      confidence = 80;
    } else {
      condition = 'RANGING';
      recommendation = 'Dikkatli olun. Piyasa yatay seyrediyor, sinyal bekleyin.';
      confidence = 60;
    }

    console.log(`📊 Piyasa Durumu: ${condition} (Güven: %${confidence})`);
    console.log(`   ${recommendation}`);

    return { condition, recommendation, confidence };
  }

  /**
   * Dinamik olarak en iyi stratejiyi seç (gerçek zamanlı)
   */
  async getRealtimeStrategy(
    symbol: string,
    timeframe: string
  ): Promise<StrategyConfig> {
    // Önce piyasa koşullarını analiz et
    const marketAnalysis = await this.analyzeMarketConditions(symbol, timeframe);

    // Koşullara göre strateji öner
    let strategyName: string;

    if (marketAnalysis.condition === 'TRENDING') {
      strategyName = 'momentum';
    } else if (marketAnalysis.condition === 'VOLATILE') {
      strategyName = 'breakout';
    } else {
      // Ranging durumda geçmiş performansa bak
      const bestStrategy = await this.selectBestStrategy(symbol, timeframe, false);
      return bestStrategy.config;
    }

    // Seçilen stratejiyi optimize et
    const optimized = await this.optimizeStrategyParameters(symbol, timeframe, strategyName);

    return optimized.config;
  }

  /**
   * Yardımcı fonksiyonlar
   */
  private buildReasonText(
    best: { strategy: string; result: BacktestResult },
    all: { strategy: string; result: BacktestResult }[]
  ): string {
    const reasons: string[] = [];

    reasons.push(`${best.strategy.toUpperCase()} stratejisi en iyi performansı gösterdi:`);
    reasons.push(`• Sharpe Ratio: ${best.result.stats.sharpeRatio.toFixed(2)} (risk-ayarlı getiri)`);
    reasons.push(`• Toplam Getiri: %${best.result.totalReturnPercent.toFixed(2)}`);
    reasons.push(`• Kazanma Oranı: %${best.result.stats.winRate.toFixed(1)}`);
    reasons.push(`• Profit Factor: ${best.result.stats.profitFactor.toFixed(2)}`);
    reasons.push(`• Max Drawdown: %${best.result.stats.maxDrawdown.toFixed(1)}`);
    reasons.push(`• Toplam İşlem: ${best.result.stats.totalTrades}`);

    reasons.push('\nDiğer stratejilerle karşılaştırma:');
    all.forEach((s, i) => {
      if (s.strategy !== best.strategy) {
        reasons.push(
          `  ${i + 1}. ${s.strategy}: %${s.result.totalReturnPercent.toFixed(2)} getiri, ` +
          `Sharpe ${s.result.stats.sharpeRatio.toFixed(2)}`
        );
      }
    });

    return reasons.join('\n');
  }

  private async getCandles(
    symbol: string,
    timeframe: string,
    days: number
  ) {
    const { BacktestingService } = await import('./backtestingService');
    const bs = new BacktestingService();
    const count = (bs as any).getCandleCount(timeframe, days);

    const binance = await import('./binanceService');
    return await binance.default.getHistoricalCandles(symbol, timeframe, count);
  }

  private calculateEMA(values: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema: number[] = [values[0]];

    for (let i = 1; i < values.length; i++) {
      ema.push(values[i] * k + ema[i - 1] * (1 - k));
    }

    return ema;
  }

  private calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number[] {
    const tr: number[] = [];

    for (let i = 1; i < highs.length; i++) {
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - closes[i - 1]);
      const lc = Math.abs(lows[i] - closes[i - 1]);
      tr.push(Math.max(hl, hc, lc));
    }

    // ATR = EMA of TR
    return this.calculateEMA(tr, period);
  }
}

export const adaptiveStrategySelector = new AdaptiveStrategySelector();
