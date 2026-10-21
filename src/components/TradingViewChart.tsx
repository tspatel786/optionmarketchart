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
        background: { type: ColorType.Solid, color: '#070a12' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#141d30' },
        horzLines: { color: '#141d30' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1e293b',
      },
      rightPriceScale: {
        borderColor: '#1e293b',
      },
      crosshair: {
        vertLine: { color: '#475569', style: 2 },
        horzLine: { color: '#475569', style: 2 },
      },
      width: chartContainerRef.current.clientWidth,
      height: window.innerWidth < 640 ? 320 : 460,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: window.innerWidth < 640 ? 320 : 460,
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
        color: '#38bdf8',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'ENTRY',
      });

      // Stop Loss Line
      seriesRef.current.createPriceLine({
        price: levels.stopLoss,
        color: '#f43f5e',
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
        color: '#34d399',
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'TARGET 2',
      });

      // Pivot Line
      seriesRef.current.createPriceLine({
        price: levels.pivot,
        color: '#fbbf24',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'PIVOT',
      });
    }
  }, [candles, levels]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-800/80 bg-[#070a12] shadow-2xl shadow-black/80">
      <div className="p-3 sm:p-4 bg-gradient-to-r from-gray-900/90 via-[#0d1424] to-gray-900/90 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-black text-white text-sm sm:text-base tracking-wide">{instrument}</span>
          <span className="text-[10px] sm:text-xs px-2 py-0.5 bg-blue-950/80 text-cyan-300 border border-cyan-800 rounded font-mono font-bold">
            5M Closed
          </span>
        </div>

        {levels && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-mono">
            <span className="text-cyan-300">Entry: ₹{levels.entryPrice.toFixed(1)}</span>
            <span className="text-rose-400">SL: ₹{levels.stopLoss.toFixed(1)}</span>
            <span className="text-emerald-400">T1: ₹{levels.target1.toFixed(1)}</span>
            <span className="text-green-300 hidden sm:inline">T2: ₹{levels.target2.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
};
