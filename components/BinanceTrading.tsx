import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import binanceService from '../src/services/binanceService';
import { TradingEngine } from '../src/services/tradingEngine';
import { RiskManager } from '../src/services/riskManagement';
import {
  TradingConfig,
  StrategyConfig,
  TradingBotStatus,
  Position,
  Trade,
  TradingLog,
  MarketData,
  AccountBalance,
  TradingSignal
} from '../src/types/trading';

const BinanceTrading: React.FC = () => {
  // API Configuration
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isTestnet, setIsTestnet] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  // Strategy Configuration
  const [selectedStrategy, setSelectedStrategy] = useState('momentum');
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('1h');
  const [symbols, setSymbols] = useState<string[]>(['BTCUSDT', 'ETHUSDT']);

  // Trading Engine
  const engineRef = useRef<TradingEngine | null>(null);
  const [botStatus, setBotStatus] = useState<TradingBotStatus>({
    isRunning: false,
    activePositions: 0,
    totalTrades: 0,
    currentPnl: 0,
    errors: []
  });

  // Market Data
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [logs, setLogs] = useState<TradingLog[]>([]);
  const [latestSignal, setLatestSignal] = useState<TradingSignal | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'positions' | 'history' | 'logs'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Binance API'yi yapılandır
   */
  const handleConfigureAPI = () => {
    if (!apiKey || !apiSecret) {
      setError('API Key ve Secret gerekli');
      return;
    }

    try {
      const config: TradingConfig = {
        apiKey,
        apiSecret,
        testnet: isTestnet
      };

      binanceService.initialize(config);
      setIsConfigured(true);
      setError(null);
      loadMarketData();
      loadBalances();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /**
   * Market verilerini yükle
   */
  const loadMarketData = async () => {
    try {
      const data = await Promise.all(
        symbols.map(symbol => binanceService.getMarketData(symbol))
      );
      setMarketData(data);
    } catch (err: any) {
      console.error('Market data hatası:', err);
    }
  };

  /**
   * Bakiyeleri yükle
   */
  const loadBalances = async () => {
    try {
      const data = await binanceService.getAccountBalances();
      setBalances(data);
    } catch (err: any) {
      console.error('Bakiye hatası:', err);
    }
  };

  /**
   * Trading botunu başlat
   */
  const handleStartBot = () => {
    if (!isConfigured) {
      setError('Önce API yapılandırmasını tamamlayın');
      return;
    }

    const strategyConfig: StrategyConfig = {
      name: selectedStrategy,
      enabled: true,
      symbols: symbols,
      timeframe: selectedTimeframe,
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

    const engine = new TradingEngine(strategyConfig);

    // Event listeners
    engine.on('statusChange', (status: TradingBotStatus) => {
      setBotStatus(status);
    });

    engine.on('signal', (signal: TradingSignal) => {
      setLatestSignal(signal);
    });

    engine.on('log', (log: TradingLog) => {
      setLogs(prev => [...prev.slice(-99), log]);
    });

    engine.on('positionOpened', () => {
      setPositions(engine.getActivePositions());
    });

    engine.on('positionClosed', () => {
      setPositions(engine.getActivePositions());
      setTrades(engine.getTradeHistory());
    });

    engineRef.current = engine;
    engine.start();
  };

  /**
   * Trading botunu durdur
   */
  const handleStopBot = () => {
    if (engineRef.current) {
      engineRef.current.stop();
    }
  };

  /**
   * Otomatik veri yenileme
   */
  useEffect(() => {
    if (!isConfigured) return;

    const interval = setInterval(() => {
      loadMarketData();
      if (engineRef.current) {
        setBotStatus(engineRef.current.getStatus());
        setPositions(engineRef.current.getActivePositions());
        setTrades(engineRef.current.getTradeHistory());
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isConfigured, symbols]);

  // Trading istatistikleri
  const stats = RiskManager.calculateTradingStats(trades);
  const totalBalance = balances.reduce((sum, b) => sum + b.usdValue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-8 rounded-3xl text-white">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black mb-2">🤖 Binance Auto Trading</h2>
            <p className="text-amber-100 font-bold">AI destekli otomatik kripto trading sistemi</p>
          </div>
          <div className="flex items-center gap-4">
            {isConfigured && (
              <div className="bg-white/20 backdrop-blur-sm px-6 py-3 rounded-2xl">
                <div className="text-xs font-bold opacity-80">TOPLAM BAKİYE</div>
                <div className="text-2xl font-black">${totalBalance.toFixed(2)}</div>
              </div>
            )}
            {botStatus.isRunning && (
              <div className="bg-green-500 px-4 py-2 rounded-full text-sm font-black flex items-center gap-2 animate-pulse">
                <div className="w-3 h-3 bg-white rounded-full"></div>
                BOT ÇALIŞIYOR
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-200">
        {(['dashboard', 'config', 'positions', 'history', 'logs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab === 'dashboard' && '📊 Dashboard'}
            {tab === 'config' && '⚙️ Yapılandırma'}
            {tab === 'positions' && '💼 Pozisyonlar'}
            {tab === 'history' && '📜 Geçmiş'}
            {tab === 'logs' && '📋 Loglar'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-2xl font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Aktif Pozisyon" value={positions.length} color="blue" />
            <StatCard title="Toplam İşlem" value={trades.length} color="purple" />
            <StatCard
              title="Toplam P&L"
              value={`$${stats.totalPnl.toFixed(2)}`}
              color={stats.totalPnl >= 0 ? 'green' : 'red'}
            />
            <StatCard title="Kazanma Oranı" value={`%${stats.winRate.toFixed(1)}`} color="amber" />
          </div>

          {/* Market Data */}
          {isConfigured && marketData.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200">
              <h3 className="text-xl font-black mb-4">📈 Market Özeti</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {marketData.map(data => (
                  <div
                    key={data.symbol}
                    className="bg-slate-50 p-4 rounded-2xl border border-slate-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-black text-lg">{data.symbol}</div>
                        <div className="text-2xl font-black text-blue-600">
                          ${data.price.toFixed(2)}
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-black ${
                          data.priceChangePercent24h >= 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {data.priceChangePercent24h >= 0 ? '▲' : '▼'}{' '}
                        {Math.abs(data.priceChangePercent24h).toFixed(2)}%
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 space-y-1">
                      <div>24h Yüksek: ${data.high24h.toFixed(2)}</div>
                      <div>24h Düşük: ${data.low24h.toFixed(2)}</div>
                      <div>24h Hacim: {(data.volume24h / 1000).toFixed(1)}K</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Latest Signal */}
          {latestSignal && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200">
              <h3 className="text-xl font-black mb-4">🎯 Son Sinyal</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-sm text-slate-500 mb-1">Sembol</div>
                    <div className="font-black text-xl">{latestSignal.symbol}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-500 mb-1">Sinyal</div>
                    <div
                      className={`font-black text-xl ${
                        latestSignal.signal.includes('BUY')
                          ? 'text-green-600'
                          : latestSignal.signal.includes('SELL')
                          ? 'text-red-600'
                          : 'text-slate-600'
                      }`}
                    >
                      {latestSignal.signal}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-500 mb-1">Güven</div>
                    <div className="font-black text-xl text-blue-600">
                      %{latestSignal.confidence}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-500 mb-1">Fiyat</div>
                    <div className="font-black text-xl">${latestSignal.price.toFixed(2)}</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-2">Nedenler:</div>
                  <ul className="space-y-1">
                    {latestSignal.reason.map((r, i) => (
                      <li key={i} className="text-sm font-bold text-slate-700">
                        • {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-xs text-slate-400">
                  Strateji: {latestSignal.strategy} | Zaman:{' '}
                  {new Date(latestSignal.timestamp).toLocaleString('tr-TR')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* API Configuration */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200">
            <h3 className="text-2xl font-black mb-6">🔑 API Yapılandırması</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Binance API Key"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none font-mono text-sm"
                  disabled={isConfigured}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  API Secret
                </label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={e => setApiSecret(e.target.value)}
                  placeholder="Binance API Secret"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none font-mono text-sm"
                  disabled={isConfigured}
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="testnet"
                  checked={isTestnet}
                  onChange={e => setIsTestnet(e.target.checked)}
                  disabled={isConfigured}
                  className="w-5 h-5"
                />
                <label htmlFor="testnet" className="font-bold text-slate-700">
                  Testnet Kullan (Gerçek işlem yapılmaz - Önerilir)
                </label>
              </div>
              {!isConfigured ? (
                <button
                  onClick={handleConfigureAPI}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black text-lg transition-all"
                >
                  ✅ API'yi Yapılandır
                </button>
              ) : (
                <div className="bg-green-50 border-2 border-green-200 text-green-800 p-4 rounded-2xl font-bold text-center">
                  ✅ API başarıyla yapılandırıldı
                </div>
              )}
            </div>
          </div>

          {/* Strategy Configuration */}
          {isConfigured && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200">
              <h3 className="text-2xl font-black mb-6">📊 Strateji Yapılandırması</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Strateji Seç
                  </label>
                  <select
                    value={selectedStrategy}
                    onChange={e => setSelectedStrategy(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none font-bold"
                    disabled={botStatus.isRunning}
                  >
                    <option value="momentum">Momentum Strategy (RSI+MACD+EMA)</option>
                    <option value="breakout">Breakout Strategy (Support/Resistance)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Zaman Dilimi
                  </label>
                  <select
                    value={selectedTimeframe}
                    onChange={e => setSelectedTimeframe(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none font-bold"
                    disabled={botStatus.isRunning}
                  >
                    <option value="1m">1 Dakika</option>
                    <option value="5m">5 Dakika</option>
                    <option value="15m">15 Dakika</option>
                    <option value="1h">1 Saat</option>
                    <option value="4h">4 Saat</option>
                    <option value="1d">1 Gün</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Trading Sembolleri
                  </label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {symbols.map(symbol => (
                      <div
                        key={symbol}
                        className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2"
                      >
                        {symbol}
                        {!botStatus.isRunning && (
                          <button
                            onClick={() => setSymbols(symbols.filter(s => s !== symbol))}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!botStatus.isRunning && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="BTCUSDT"
                        id="newSymbol"
                        className="flex-1 px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none font-bold"
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('newSymbol') as HTMLInputElement;
                          if (input.value && !symbols.includes(input.value.toUpperCase())) {
                            setSymbols([...symbols, input.value.toUpperCase()]);
                            input.value = '';
                          }
                        }}
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold"
                      >
                        Ekle
                      </button>
                    </div>
                  )}
                </div>
                <div className="pt-4">
                  {!botStatus.isRunning ? (
                    <button
                      onClick={handleStartBot}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-2xl font-black text-lg transition-all"
                    >
                      🚀 BOTU BAŞLAT
                    </button>
                  ) : (
                    <button
                      onClick={handleStopBot}
                      className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-2xl font-black text-lg transition-all"
                    >
                      ⏹️ BOTU DURDUR
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200">
          <h3 className="text-xl font-black mb-4">💼 Aktif Pozisyonlar</h3>
          {positions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              Aktif pozisyon bulunmuyor
            </div>
          ) : (
            <div className="space-y-4">
              {positions.map(pos => {
                const risk = RiskManager.calculatePositionRisk(pos);
                return (
                  <div
                    key={pos.id}
                    className="border-2 border-slate-200 p-4 rounded-2xl"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-black text-xl">{pos.symbol}</div>
                        <div
                          className={`text-sm font-bold ${
                            pos.side === 'LONG' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {pos.side} • {pos.quantity.toFixed(6)}
                        </div>
                      </div>
                      <div
                        className={`px-4 py-2 rounded-xl font-black ${
                          pos.unrealizedPnl >= 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)} (
                        {pos.unrealizedPnlPercent.toFixed(2)}%)
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-slate-500">Giriş</div>
                        <div className="font-black">${pos.entryPrice.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Güncel</div>
                        <div className="font-black">${pos.currentPrice.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Stop Loss</div>
                        <div className="font-black text-red-600">
                          ${pos.stopLoss?.toFixed(2) || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Take Profit</div>
                        <div className="font-black text-green-600">
                          ${pos.takeProfit?.toFixed(2) || '-'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      Risk: ${risk.riskAmount.toFixed(2)} ({risk.riskPercent.toFixed(2)}%) | R/R:{' '}
                      {risk.riskReward.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Kazanma Oranı</div>
              <div className="text-2xl font-black text-blue-600">%{stats.winRate.toFixed(1)}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Profit Factor</div>
              <div className="text-2xl font-black text-purple-600">
                {stats.profitFactor.toFixed(2)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Sharpe Ratio</div>
              <div className="text-2xl font-black text-amber-600">
                {stats.sharpeRatio.toFixed(2)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Max Drawdown</div>
              <div className="text-2xl font-black text-red-600">
                %{stats.maxDrawdown.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Trade History */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200">
            <h3 className="text-xl font-black mb-4">📜 İşlem Geçmişi</h3>
            {trades.length === 0 ? (
              <div className="text-center py-12 text-slate-400">İşlem geçmişi boş</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {[...trades].reverse().map(trade => (
                  <div
                    key={trade.id}
                    className="flex justify-between items-center p-3 rounded-xl border border-slate-200 hover:bg-slate-50"
                  >
                    <div>
                      <div className="font-black">{trade.symbol}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(trade.time).toLocaleString('tr-TR')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-black ${
                          trade.side === 'BUY' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {trade.side}
                      </div>
                      <div className="text-sm text-slate-600">
                        {trade.quantity.toFixed(6)} @ ${trade.price.toFixed(2)}
                      </div>
                    </div>
                    {trade.pnl !== undefined && (
                      <div
                        className={`font-black ${
                          trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 p-6 rounded-3xl text-white font-mono text-sm">
          <h3 className="text-xl font-black mb-4">📋 Bot Logları</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-slate-400 text-center py-12">Log bulunmuyor</div>
            ) : (
              [...logs].reverse().map((log, i) => (
                <div
                  key={i}
                  className={`p-2 rounded ${
                    log.level === 'ERROR'
                      ? 'bg-red-900/30 text-red-300'
                      : log.level === 'WARNING'
                      ? 'bg-yellow-900/30 text-yellow-300'
                      : log.level === 'SUCCESS'
                      ? 'bg-green-900/30 text-green-300'
                      : 'bg-slate-800/30'
                  }`}
                >
                  <span className="text-slate-400">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>{' '}
                  <span className="font-bold">[{log.level}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({
  title,
  value,
  color
}: {
  title: string;
  value: string | number;
  color: string;
}) => {
  const colorClass = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600'
  }[color] || 'text-slate-600';

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200">
      <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">{title}</div>
      <div className={`text-3xl font-black ${colorClass}`}>{value}</div>
    </div>
  );
};

export default BinanceTrading;
