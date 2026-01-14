import { RiskManagement, Position, Trade, TradingStats } from '../types/trading';

/**
 * Risk Yönetimi ve İstatistik Hesaplamaları
 */
export class RiskManager {
  /**
   * Pozisyon büyüklüğünü hesaplar (Kelly Criterion)
   */
  static calculatePositionSize(
    accountBalance: number,
    riskPerTrade: number, // Yüzde olarak (örn: 2)
    entryPrice: number,
    stopLoss: number
  ): number {
    const riskAmount = accountBalance * (riskPerTrade / 100);
    const priceRisk = Math.abs(entryPrice - stopLoss);
    const quantity = riskAmount / priceRisk;

    return quantity;
  }

  /**
   * Risk/Reward oranını hesaplar
   */
  static calculateRiskReward(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    side: 'LONG' | 'SHORT'
  ): number {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);

    return reward / risk;
  }

  /**
   * Maksimum drawdown hesaplar
   */
  static calculateMaxDrawdown(equityCurve: { timestamp: number; balance: number }[]): number {
    let maxDrawdown = 0;
    let peak = equityCurve[0]?.balance || 0;

    for (const point of equityCurve) {
      if (point.balance > peak) {
        peak = point.balance;
      }

      const drawdown = ((peak - point.balance) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Sharpe Ratio hesaplar (yıllık)
   */
  static calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );

    if (stdDev === 0) return 0;

    // Yıllık Sharpe (252 trading günü)
    const annualizedReturn = avgReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);

    return (annualizedReturn - riskFreeRate) / annualizedStdDev;
  }

  /**
   * Trading istatistiklerini hesaplar
   */
  static calculateTradingStats(trades: Trade[]): TradingStats {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        currentDrawdown: 0
      };
    }

    const realizedTrades = trades.filter(t => t.realized && t.pnl !== undefined);

    const wins = realizedTrades.filter(t => t.pnl! > 0);
    const losses = realizedTrades.filter(t => t.pnl! < 0);

    const totalPnl = realizedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalPnlPercent = realizedTrades.reduce((sum, t) => sum + (t.pnlPercent || 0), 0);

    const averageWin = wins.length > 0
      ? wins.reduce((sum, t) => sum + t.pnl!, 0) / wins.length
      : 0;

    const averageLoss = losses.length > 0
      ? Math.abs(losses.reduce((sum, t) => sum + t.pnl!, 0) / losses.length)
      : 0;

    const grossProfit = wins.reduce((sum, t) => sum + t.pnl!, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl!, 0));

    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const winRate = realizedTrades.length > 0
      ? (wins.length / realizedTrades.length) * 100
      : 0;

    // Equity curve oluştur (basitleştirilmiş)
    let runningBalance = 10000; // Başlangıç
    const equityCurve = realizedTrades.map(t => {
      runningBalance += t.pnl || 0;
      return { timestamp: t.time, balance: runningBalance };
    });

    const maxDrawdown = this.calculateMaxDrawdown(equityCurve);
    const currentDrawdown = equityCurve.length > 0
      ? maxDrawdown // Basitleştirilmiş
      : 0;

    // Returns hesapla
    const returns = realizedTrades.map(t => (t.pnlPercent || 0) / 100);
    const sharpeRatio = this.calculateSharpeRatio(returns);

    return {
      totalTrades: realizedTrades.length,
      winRate,
      totalPnl,
      totalPnlPercent,
      averageWin,
      averageLoss,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      currentDrawdown
    };
  }

  /**
   * Pozisyon için liquidation fiyatını hesaplar (leverage ile)
   */
  static calculateLiquidationPrice(
    entryPrice: number,
    leverage: number,
    side: 'LONG' | 'SHORT',
    maintenanceMargin: number = 0.004 // %0.4 (Binance default)
  ): number {
    if (side === 'LONG') {
      return entryPrice * (1 - (1 / leverage) + maintenanceMargin);
    } else {
      return entryPrice * (1 + (1 / leverage) - maintenanceMargin);
    }
  }

  /**
   * Volatilite bazlı pozisyon büyüklüğü ayarı
   */
  static adjustPositionSizeByVolatility(
    baseSize: number,
    currentATR: number,
    averageATR: number
  ): number {
    const volatilityRatio = currentATR / averageATR;

    // Yüksek volatilitede pozisyonu küçült
    if (volatilityRatio > 1.5) {
      return baseSize * 0.6; // %40 azalt
    } else if (volatilityRatio > 1.2) {
      return baseSize * 0.8; // %20 azalt
    } else if (volatilityRatio < 0.8) {
      return baseSize * 1.2; // %20 artır
    }

    return baseSize;
  }

  /**
   * Korelasyon kontrolü (çoklu pozisyonlar için)
   */
  static checkCorrelation(positions: Position[]): { isHighlyCorrelated: boolean; warning: string } {
    // Basitleştirilmiş: Aynı yönde çok fazla pozisyon varsa uyar
    const longCount = positions.filter(p => p.side === 'LONG').length;
    const shortCount = positions.filter(p => p.side === 'SHORT').length;

    if (longCount > 5 || shortCount > 5) {
      return {
        isHighlyCorrelated: true,
        warning: `⚠️ Tek yönde çok fazla pozisyon: ${longCount} LONG, ${shortCount} SHORT`
      };
    }

    return { isHighlyCorrelated: false, warning: '' };
  }

  /**
   * Varsayılan risk yönetimi ayarları
   */
  static getDefaultRiskManagement(): RiskManagement {
    return {
      maxPositionSize: 5, // Portföyün %5'i
      maxLeverage: 3,
      stopLossPercent: 2, // %2 stop loss
      takeProfitPercent: 6, // %6 take profit (1:3 R/R)
      maxDailyLoss: 100, // $100 günlük maksimum zarar
      maxOpenPositions: 5,
      riskRewardRatio: 3 // Minimum 1:3 R/R
    };
  }

  /**
   * Pozisyon için gerçek zamanlı risk metrikleri
   */
  static calculatePositionRisk(position: Position): {
    riskAmount: number;
    riskPercent: number;
    potentialProfit: number;
    potentialProfitPercent: number;
    riskReward: number;
  } {
    const positionValue = position.entryPrice * position.quantity;
    const stopLossDistance = position.stopLoss
      ? Math.abs(position.entryPrice - position.stopLoss)
      : 0;
    const takeProfitDistance = position.takeProfit
      ? Math.abs(position.takeProfit - position.entryPrice)
      : 0;

    const riskAmount = stopLossDistance * position.quantity;
    const riskPercent = (stopLossDistance / position.entryPrice) * 100;

    const potentialProfit = takeProfitDistance * position.quantity;
    const potentialProfitPercent = (takeProfitDistance / position.entryPrice) * 100;

    const riskReward = riskAmount > 0 ? potentialProfit / riskAmount : 0;

    return {
      riskAmount,
      riskPercent,
      potentialProfit,
      potentialProfitPercent,
      riskReward
    };
  }
}
