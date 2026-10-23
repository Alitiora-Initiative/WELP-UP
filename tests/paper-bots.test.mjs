import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePaperGridTick, paperGridIndex, paperStopReason, validatePaperBotSettings } from '../lib/paper-bots.ts';

const validSettings = {
  symbol: 'SOLUSDT',
  investment: 100,
  lowerPrice: 95,
  upperPrice: 105,
  referencePrice: 100,
  gridCount: 8,
  takeProfitPct: 4,
  stopLossPct: 3,
  durationHours: 24,
};

test('accepts a valid paper bot setup and rejects invalid ranges and allocations', () => {
  assert.equal(validatePaperBotSettings(validSettings, 0), null);
  assert.match(validatePaperBotSettings({ ...validSettings, upperPrice: 90 }, 0), /upper price/);
  assert.match(validatePaperBotSettings({ ...validSettings, investment: 9 }, 0), /between \$10/);
  assert.match(validatePaperBotSettings(validSettings, 12), /up to 12/);
});

test('maps marks to grid levels and clamps prices to the configured range', () => {
  assert.equal(paperGridIndex(95, 95, 105, 10), 0);
  assert.equal(paperGridIndex(100, 95, 105, 10), 5);
  assert.equal(paperGridIndex(105, 95, 105, 10), 10);
  assert.equal(paperGridIndex(120, 95, 105, 10), 10);
});

test('records a completed grid cycle and applies direction to unpaired P&L', () => {
  const state = { ...validSettings, gridIndex: 2, gridFills: 0, cycles: 0, gridProfit: 0, direction: 'Long' };
  const result = calculatePaperGridTick(state, 104);
  assert.equal(result.index, 7);
  assert.equal(result.newFills, 5);
  assert.equal(result.newCycles, 2);
  assert.ok(result.gridProfit > 0);
  assert.equal(result.unpairedPnl, 4);
  assert.equal(calculatePaperGridTick({ ...state, direction: 'Short' }, 104).unpairedPnl, -4);
  assert.equal(calculatePaperGridTick({ ...state, direction: 'Neutral' }, 104).unpairedPnl, 0);
});

test('stops on configured risk, time, and range limits', () => {
  const base = { ...validSettings, mark: 100, totalPnl: 0, stopCondition: 'Manual', runtimeMs: 0 };
  assert.equal(paperStopReason(base), '');
  assert.equal(paperStopReason({ ...base, stopCondition: 'Take profit / stop loss', totalPnl: 4 }), 'Take profit / stop loss reached');
  assert.equal(paperStopReason({ ...base, stopCondition: 'Run time limit', runtimeMs: 24 * 3_600_000 }), 'Run time limit reached');
  assert.equal(paperStopReason({ ...base, mark: 106 }), 'Price moved outside configured range');
});
