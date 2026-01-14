// Binance Trading Module Types

export interface TradingConfig {
  apiKey: string;
  apiSecret: string;
  testnet?: boolean;
}

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';
export type PositionSide = 'LONG' | 'SHORT' | 'BOTH';

export interface CandlestickData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  trades: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    MACD: number;
    signal: number;
    histogram: number;
  };
  ema: {
    ema9: number;
    ema21: number;
    ema50: number;
    ema200: number;
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
  };
  atr: number;
  volume: {
    current: number;
    average: number;
    ratio: number;
  };
}

export type SignalStrength = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface TradingSignal {
  timestamp: number;
  symbol: string;
  signal: SignalStrength;
  confidence: number; // 0-100
  price: number;
  indicators: TechnicalIndicators;
  reason: string[];
  strategy: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  liquidationPrice?: number;
  openTime: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  quantity: number;
  commission: number;
  commissionAsset: string;
  time: number;
  realized: boolean;
  pnl?: number;
  pnlPercent?: number;
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: TimeInForce;
}

export interface AccountBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue: number;
}

export interface TradingStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
}

export interface RiskManagement {
  maxPositionSize: number; // Maximum position size as % of portfolio
  maxLeverage: number;
  stopLossPercent: number; // Default stop loss %
  takeProfitPercent: number; // Default take profit %
  maxDailyLoss: number; // Maximum daily loss in USD
  maxOpenPositions: number;
  riskRewardRatio: number; // Minimum risk/reward ratio
}

export interface StrategyConfig {
  name: string;
  enabled: boolean;
  symbols: string[];
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  indicators: {
    rsi: { period: number; overbought: number; oversold: number };
    macd: { fast: number; slow: number; signal: number };
    ema: { periods: number[] };
    bollinger: { period: number; stdDev: number };
    atr: { period: number };
  };
  entryConditions: string[];
  exitConditions: string[];
  riskManagement: RiskManagement;
}

export interface TradingBotStatus {
  isRunning: boolean;
  startTime?: number;
  uptime?: number;
  lastSignalTime?: number;
  activePositions: number;
  totalTrades: number;
  currentPnl: number;
  errors: string[];
}

export interface MarketData {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  lastUpdate: number;
}

export interface BacktestResult {
  startDate: number;
  endDate: number;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalReturnPercent: number;
  trades: Trade[];
  stats: TradingStats;
  equityCurve: { timestamp: number; balance: number }[];
  drawdownCurve: { timestamp: number; drawdown: number }[];
}

export interface TradingLog {
  timestamp: number;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  message: string;
  data?: any;
}
