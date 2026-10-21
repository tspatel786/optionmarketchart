import { HistoricalDataService } from '../src/engine/historicalCandles';
import { MultiStrategyBacktester } from '../src/engine/multiStrategyBacktester';

const candles = HistoricalDataService.getHistoricalCandles('NIFTY 50');
console.log('Total candles generated:', candles.length);

const result = MultiStrategyBacktester.runAllStrategiesBacktest('NIFTY 50', candles, 75);

console.log('=== MULTI-STRATEGY LEADERBOARD (Top 12) ===');
result.leaderboard.slice(0, 12).forEach(s => {
  console.log(`#${s.rank} [ID ${s.strategyId}] ${s.strategyName} | Net Win: ${s.netWinRate}% | Trades: ${s.totalTrades} | PnL: ₹${s.totalNetPnlInr} | Status: ${s.status}`);
});

console.log('\nTotal Qualified Strategies (>= 75% Win Rate):', result.qualifiedStrategiesCount);
console.log('Total Muted Strategies (< 75% Win Rate):', result.mutedStrategiesCount);
console.log('Top Strategy:', result.topStrategy.strategyName, `(${result.topStrategy.netWinRate}%)`);
