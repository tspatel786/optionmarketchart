import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, type IChartApi, type ISeriesApi, type CandlestickData, type Time } from 'lightweight-charts';
import type { MarketCandle } from '../services/growwService';
import type { TradeLevels } from '../engine/pivotCalculator';

interface TradingViewChartProps {
  candles: MarketCandle[];
  levels?: TradeLevels;
  instrument: string;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({ candles, levels, instrument }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0f19' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1f2937',
      },
      rightPriceScale: {
        borderColor: '#1f2937',
      },
      crosshair: {
        vertLine: { color: '#4b5563', style: 2 },
        horzLine: { color: '#4b5563', style: 2 },
      },
      width: chartContainerRef.current.clientWidth,
      height: 420,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update candle data & horizontal price lines
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    if (candles && candles.length > 0) {
      const formattedData: CandlestickData<Time>[] = candles.map((c) => ({
        time: c.timestamp as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      // Sort by time ascending
      formattedData.sort((a, b) => (a.time as number) - (b.time as number));
      seriesRef.current.setData(formattedData);
      chartRef.current.timeScale().fitContent();
    }

    // Add Trade levels lines (Entry, Stop Loss, Target 1, Target 2, Pivot)
    if (levels && seriesRef.current) {
      // Entry Line
      seriesRef.current.createPriceLine({
        price: levels.entryPrice,
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'ENTRY',
      });

      // Stop Loss Line
      seriesRef.current.createPriceLine({
        price: levels.stopLoss,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'STOP LOSS',
      });

      // Target 1 Line
      seriesRef.current.createPriceLine({
        price: levels.target1,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'TARGET 1',
      });

      // Target 2 Line
      seriesRef.current.createPriceLine({
        price: levels.target2,
        color: '#059669',
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'TARGET 2',
      });

      // Pivot Line
      seriesRef.current.createPriceLine({
        price: levels.pivot,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'PIVOT',
      });
    }
  }, [candles, levels]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-borderCol bg-darkBg">
      <div className="p-3 bg-cardBg border-b border-borderCol flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm">{instrument}</span>
          <span className="text-xs px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded font-mono">
            5M Closed Candles
          </span>
        </div>

        {levels && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-blue-400 font-mono">Entry: {levels.entryPrice.toFixed(2)}</span>
            <span className="text-red-400 font-mono">SL: {levels.stopLoss.toFixed(2)}</span>
            <span className="text-emerald-400 font-mono">T1: {levels.target1.toFixed(2)}</span>
            <span className="text-emerald-500 font-mono">T2: {levels.target2.toFixed(2)}</span>
            <span className="text-amber-400 font-mono">P: {levels.pivot.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
};
