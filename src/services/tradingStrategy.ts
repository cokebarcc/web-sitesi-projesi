import {
  RSI,
  MACD,
  EMA,
  BollingerBands,
  ATR,
  SMA
} from 'technicalindicators';
import {
  CandlestickData,
  TechnicalIndicators,
  TradingSignal,
  SignalStrength,
  StrategyConfig
} from '../types/trading';

/**
 * Teknik Analiz Motoru
 * Geçmiş fiyat verilerinden teknik indikatörler hesaplar
 */
export class TechnicalAnalysisEngine {
  /**
   * Tüm teknik indikatörleri hesaplar
   */
  calculateIndicators(
    candles: CandlestickData[],
    config: StrategyConfig
  ): TechnicalIndicators {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    // RSI hesaplama
    const rsiValues = RSI.calculate({
      values: closes,
      period: config.indicators.rsi.period
    });
    const currentRSI = rsiValues[rsiValues.length - 1] || 50;

    // MACD hesaplama
    const macdValues = MACD.calculate({
      values: closes,
      fastPeriod: config.indicators.macd.fast,
      slowPeriod: config.indicators.macd.slow,
      signalPeriod: config.indicators.macd.signal,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
    const currentMACD = macdValues[macdValues.length - 1] || {
      MACD: 0,
      signal: 0,
      histogram: 0
    };

    // EMA hesaplama
    const ema9Values = EMA.calculate({ period: 9, values: closes });
    const ema21Values = EMA.calculate({ period: 21, values: closes });
    const ema50Values = EMA.calculate({ period: 50, values: closes });
    const ema200Values = EMA.calculate({ period: 200, values: closes });

    const ema = {
      ema9: ema9Values[ema9Values.length - 1] || closes[closes.length - 1],
      ema21: ema21Values[ema21Values.length - 1] || closes[closes.length - 1],
      ema50: ema50Values[ema50Values.length - 1] || closes[closes.length - 1],
      ema200: ema200Values[ema200Values.length - 1] || closes[closes.length - 1]
    };

    // Bollinger Bands hesaplama
    const bbValues = BollingerBands.calculate({
      period: config.indicators.bollinger.period,
      values: closes,
      stdDev: config.indicators.bollinger.stdDev
    });
    const currentBB = bbValues[bbValues.length - 1] || {
      upper: closes[closes.length - 1] * 1.02,
      middle: closes[closes.length - 1],
      lower: closes[closes.length - 1] * 0.98
    };

    // ATR hesaplama (volatilite)
    const atrValues = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: config.indicators.atr.period
    });
    const currentATR = atrValues[atrValues.length - 1] || 0;

    // Hacim analizi
    const volumeAvg = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];

    return {
      rsi: currentRSI,
      macd: currentMACD,
      ema,
      bollinger: currentBB,
      atr: currentATR,
      volume: {
        current: currentVolume,
        average: volumeAvg,
        ratio: currentVolume / volumeAvg
      }
    };
  }

  /**
   * Trend yönünü belirler
   */
  detectTrend(indicators: TechnicalIndicators, currentPrice: number): 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' {
    const { ema } = indicators;

    // EMA hiyerarşisi kontrolü
    if (ema.ema9 > ema.ema21 && ema.ema21 > ema.ema50 && currentPrice > ema.ema9) {
      return 'UPTREND'; // Güçlü yükseliş trendi
    }

    if (ema.ema9 < ema.ema21 && ema.ema21 < ema.ema50 && currentPrice < ema.ema9) {
      return 'DOWNTREND'; // Güçlü düşüş trendi
    }

    return 'SIDEWAYS'; // Yatay trend
  }
}

/**
 * Multi-İndikatör Momentum Stratejisi
 * RSI, MACD, EMA ve Bollinger Bands kombinasyonu
 */
export class MomentumStrategy {
  private engine: TechnicalAnalysisEngine;

  constructor() {
    this.engine = new TechnicalAnalysisEngine();
  }

  /**
   * Trading sinyali üretir
   */
  generateSignal(
    candles: CandlestickData[],
    config: StrategyConfig
  ): TradingSignal {
    const currentPrice = candles[candles.length - 1].close;
    const indicators = this.engine.calculateIndicators(candles, config);
    const trend = this.engine.detectTrend(indicators, currentPrice);

    let signal: SignalStrength = 'NEUTRAL';
    let confidence = 0;
    const reasons: string[] = [];

    // ALIM SİNYALLERİ
    let buyScore = 0;

    // 1. RSI Oversold (Aşırı Satım)
    if (indicators.rsi < config.indicators.rsi.oversold) {
      buyScore += 25;
      reasons.push(`RSI aşırı satım bölgesinde (${indicators.rsi.toFixed(2)})`);
    } else if (indicators.rsi < 45) {
      buyScore += 10;
      reasons.push(`RSI düşük seviyede (${indicators.rsi.toFixed(2)})`);
    }

    // 2. MACD Bullish Crossover
    if (indicators.macd.MACD > indicators.macd.signal && indicators.macd.histogram > 0) {
      buyScore += 20;
      reasons.push('MACD yükseliş sinyali (pozitif histogram)');
    }

    // 3. Fiyat Bollinger Alt Bandına yakın
    const bbPosition = (currentPrice - indicators.bollinger.lower) /
                       (indicators.bollinger.upper - indicators.bollinger.lower);
    if (bbPosition < 0.2) {
      buyScore += 15;
      reasons.push('Fiyat Bollinger alt bandına yakın');
    }

    // 4. EMA Golden Cross (kısa > uzun)
    if (indicators.ema.ema9 > indicators.ema.ema21 && trend === 'UPTREND') {
      buyScore += 20;
      reasons.push('EMA yükseliş trendi (Golden Cross)');
    }

    // 5. Hacim artışı
    if (indicators.volume.ratio > 1.5) {
      buyScore += 10;
      reasons.push(`Hacim artışı (${indicators.volume.ratio.toFixed(2)}x)`);
    }

    // SATIM SİNYALLERİ
    let sellScore = 0;

    // 1. RSI Overbought (Aşırı Alım)
    if (indicators.rsi > config.indicators.rsi.overbought) {
      sellScore += 25;
      reasons.push(`RSI aşırı alım bölgesinde (${indicators.rsi.toFixed(2)})`);
    } else if (indicators.rsi > 65) {
      sellScore += 10;
      reasons.push(`RSI yüksek seviyede (${indicators.rsi.toFixed(2)})`);
    }

    // 2. MACD Bearish Crossover
    if (indicators.macd.MACD < indicators.macd.signal && indicators.macd.histogram < 0) {
      sellScore += 20;
      reasons.push('MACD düşüş sinyali (negatif histogram)');
    }

    // 3. Fiyat Bollinger Üst Bandına yakın
    if (bbPosition > 0.8) {
      sellScore += 15;
      reasons.push('Fiyat Bollinger üst bandına yakın');
    }

    // 4. EMA Death Cross (kısa < uzun)
    if (indicators.ema.ema9 < indicators.ema.ema21 && trend === 'DOWNTREND') {
      sellScore += 20;
      reasons.push('EMA düşüş trendi (Death Cross)');
    }

    // 5. Hacim düşüşü ve fiyat yüksek
    if (indicators.volume.ratio < 0.7 && indicators.rsi > 60) {
      sellScore += 10;
      reasons.push('Hacim düşüşü ile divergence');
    }

    // Sinyal ve güven belirleme
    if (buyScore > sellScore) {
      confidence = buyScore;
      if (buyScore >= 70) {
        signal = 'STRONG_BUY';
      } else if (buyScore >= 40) {
        signal = 'BUY';
      }
    } else if (sellScore > buyScore) {
      confidence = sellScore;
      if (sellScore >= 70) {
        signal = 'STRONG_SELL';
      } else if (sellScore >= 40) {
        signal = 'SELL';
      }
    } else {
      confidence = 50;
      signal = 'NEUTRAL';
      reasons.push('Kararsız piyasa - bekleme önerilir');
    }

    // Trend bilgisi ekle
    if (trend === 'UPTREND') {
      reasons.push('📈 Genel trend: YUKSELIŞ');
    } else if (trend === 'DOWNTREND') {
      reasons.push('📉 Genel trend: DÜŞÜŞ');
    } else {
      reasons.push('➡️ Genel trend: YATAY');
    }

    return {
      timestamp: Date.now(),
      symbol: config.symbols[0], // İlk sembol
      signal,
      confidence: Math.min(confidence, 100),
      price: currentPrice,
      indicators,
      reason: reasons,
      strategy: 'Momentum Strategy (RSI+MACD+EMA+BB)'
    };
  }

  /**
   * Stop loss ve take profit seviyelerini hesaplar
   */
  calculateExitLevels(
    entryPrice: number,
    signal: SignalStrength,
    indicators: TechnicalIndicators,
    riskManagement: any
  ): { stopLoss: number; takeProfit: number } {
    const atrMultiplier = 2; // ATR çarpanı
    const atrDistance = indicators.atr * atrMultiplier;

    let stopLoss: number;
    let takeProfit: number;

    if (signal === 'STRONG_BUY' || signal === 'BUY') {
      // Long pozisyon
      stopLoss = entryPrice - atrDistance;
      takeProfit = entryPrice + (atrDistance * riskManagement.riskRewardRatio);

      // Bollinger bandlarını da dikkate al
      if (indicators.bollinger.lower > stopLoss) {
        stopLoss = indicators.bollinger.lower * 0.995; // %0.5 buffer
      }
    } else {
      // Short pozisyon
      stopLoss = entryPrice + atrDistance;
      takeProfit = entryPrice - (atrDistance * riskManagement.riskRewardRatio);

      // Bollinger bandlarını da dikkate al
      if (indicators.bollinger.upper < stopLoss) {
        stopLoss = indicators.bollinger.upper * 1.005; // %0.5 buffer
      }
    }

    return {
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit: parseFloat(takeProfit.toFixed(2))
    };
  }
}

/**
 * Breakout (Kırılım) Stratejisi
 * Fiyat destek/direnç seviyelerini kırdığında işlem açar
 */
export class BreakoutStrategy {
  private engine: TechnicalAnalysisEngine;

  constructor() {
    this.engine = new TechnicalAnalysisEngine();
  }

  /**
   * Destek ve direnç seviyelerini belirler
   */
  private findSupportResistance(candles: CandlestickData[]): {
    support: number;
    resistance: number;
  } {
    const recentCandles = candles.slice(-50); // Son 50 mum
    const highs = recentCandles.map(c => c.high);
    const lows = recentCandles.map(c => c.low);

    // Basit destek/direnç (pivot points)
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const avgClose = recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length;

    return {
      resistance: maxHigh,
      support: minLow
    };
  }

  generateSignal(
    candles: CandlestickData[],
    config: StrategyConfig
  ): TradingSignal {
    const currentPrice = candles[candles.length - 1].close;
    const previousPrice = candles[candles.length - 2].close;
    const indicators = this.engine.calculateIndicators(candles, config);
    const { support, resistance } = this.findSupportResistance(candles);

    let signal: SignalStrength = 'NEUTRAL';
    let confidence = 50;
    const reasons: string[] = [];

    const resistanceBreakout = currentPrice > resistance && previousPrice <= resistance;
    const supportBreakdown = currentPrice < support && previousPrice >= support;

    // Direnç kırılımı (ALIM)
    if (resistanceBreakout && indicators.volume.ratio > 1.3) {
      signal = 'STRONG_BUY';
      confidence = 85;
      reasons.push(`Direnç seviyesi kırıldı: ${resistance.toFixed(2)}`);
      reasons.push(`Yüksek hacimle onaylandı (${indicators.volume.ratio.toFixed(2)}x)`);

      if (indicators.rsi < 70) {
        confidence += 10;
        reasons.push('RSI henüz aşırı alımda değil');
      }
    }

    // Destek kırılımı (SATIM)
    else if (supportBreakdown && indicators.volume.ratio > 1.3) {
      signal = 'STRONG_SELL';
      confidence = 85;
      reasons.push(`Destek seviyesi kırıldı: ${support.toFixed(2)}`);
      reasons.push(`Yüksek hacimle onaylandı (${indicators.volume.ratio.toFixed(2)}x)`);

      if (indicators.rsi > 30) {
        confidence += 10;
        reasons.push('RSI henüz aşırı satımda değil');
      }
    }

    // Konsolidasyon (bekleme)
    else {
      reasons.push(`Fiyat ${support.toFixed(2)} - ${resistance.toFixed(2)} aralığında`);
      reasons.push('Kırılım bekleniyor...');
    }

    return {
      timestamp: Date.now(),
      symbol: config.symbols[0],
      signal,
      confidence: Math.min(confidence, 100),
      price: currentPrice,
      indicators,
      reason: reasons,
      strategy: 'Breakout Strategy (Support/Resistance)'
    };
  }
}

/**
 * Strateji Fabrikası
 */
export class StrategyFactory {
  static createStrategy(strategyName: string): MomentumStrategy | BreakoutStrategy {
    switch (strategyName.toLowerCase()) {
      case 'momentum':
        return new MomentumStrategy();
      case 'breakout':
        return new BreakoutStrategy();
      default:
        return new MomentumStrategy(); // Varsayılan
    }
  }
}
