export type PaperDirection = 'Long' | 'Short' | 'Neutral';
export type PaperStopCondition = 'Manual' | 'Take profit / stop loss' | 'Run time limit';

export type PaperBotSettings = {
  symbol: string;
  investment: number;
  lowerPrice: number;
  upperPrice: number;
  referencePrice: number;
  gridCount: number;
  takeProfitPct: number;
  stopLossPct: number;
  durationHours: number;
};

export type PaperGridState = PaperBotSettings & {
  gridIndex: number;
  gridFills: number;
  cycles: number;
  gridProfit: number;
  direction: PaperDirection;
};

export function validatePaperBotSettings(settings: PaperBotSettings, existingBots: number): string | null {
  const { symbol, investment, lowerPrice, upperPrice, referencePrice, gridCount, takeProfitPct, stopLossPct, durationHours } = settings;
  if (existingBots >= 12) return 'Keep up to 12 paper bots in this browser.';
  if (!symbol.trim() || !/^[A-Za-z0-9._-]{2,18}$/.test(symbol.trim())) return 'Enter a market symbol such as SOLUSDT.';
  if (![investment, lowerPrice, upperPrice, referencePrice, gridCount, takeProfitPct, stopLossPct, durationHours].every(Number.isFinite)) return 'Check each numeric setting and try again.';
  if (investment < 10 || investment > 1_000_000) return 'Paper investment must be between $10 and $1,000,000.';
  if (lowerPrice <= 0 || upperPrice <= lowerPrice || referencePrice <= 0) return 'Use a positive reference price and a range where the upper price is above the lower price.';
  if (referencePrice < lowerPrice || referencePrice > upperPrice) return 'Reference price must sit inside the selected range.';
  if (!Number.isInteger(gridCount) || gridCount < 2 || gridCount > 100) return 'Choose between 2 and 100 grid levels.';
  if (takeProfitPct < 0.1 || takeProfitPct > 100 || stopLossPct < 0.1 || stopLossPct > 100) return 'Take profit and stop loss must each be between 0.1% and 100%.';
  if (durationHours < 1 || durationHours > 720) return 'Run time limit must be between 1 and 720 hours.';
  return null;
}

export function paperGridIndex(price: number, low: number, high: number, grids: number) {
  return Math.max(0, Math.min(grids, Math.floor(((price - low) / (high - low)) * grids)));
}

export function calculatePaperGridTick(state: PaperGridState, mark: number) {
  const index = paperGridIndex(mark, state.lowerPrice, state.upperPrice, state.gridCount);
  const newFills = Math.abs(index - state.gridIndex);
  const newCycles = Math.floor((state.gridFills + newFills) / 2) - Math.floor(state.gridFills / 2);
  const gridStep = (state.upperPrice - state.lowerPrice) / state.gridCount;
  const gridProfit = state.gridProfit + newCycles * (state.investment / state.gridCount) * (gridStep / state.referencePrice);
  const sideMultiplier = state.direction === 'Long' ? 1 : state.direction === 'Short' ? -1 : 0;
  const unpairedPnl = ((mark - state.referencePrice) / state.referencePrice) * state.investment * sideMultiplier;
  return { index, newFills, newCycles, gridProfit, unpairedPnl };
}

export function paperStopReason(input: {
  mark: number;
  lowerPrice: number;
  upperPrice: number;
  totalPnl: number;
  investment: number;
  takeProfitPct: number;
  stopLossPct: number;
  stopCondition: PaperStopCondition;
  runtimeMs: number;
  durationHours: number;
}) {
  if (input.mark < input.lowerPrice || input.mark > input.upperPrice) return 'Price moved outside configured range';
  if (input.stopCondition === 'Take profit / stop loss' &&
    (input.totalPnl >= input.investment * input.takeProfitPct / 100 || input.totalPnl <= -input.investment * input.stopLossPct / 100)) {
    return 'Take profit / stop loss reached';
  }
  if (input.stopCondition === 'Run time limit' && input.runtimeMs >= input.durationHours * 3_600_000) return 'Run time limit reached';
  return '';
}
