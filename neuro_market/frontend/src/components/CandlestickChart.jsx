import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickSeries, AreaSeries, createChart } from 'lightweight-charts';
import axios from 'axios';
import { BarChart2, TrendingUp, Clock } from 'lucide-react';

const CandlestickChart = ({ symbol, markers = [], onPrice, height = 380 }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const lastBarRef = useRef(null);
  const [chartType, setChartType] = useState('candlestick'); // 'candlestick' or 'area'
  const [timeframe, setTimeframe] = useState('1D'); // '1D', '5D', '1M', '6M', '1Y'

  const timeframeConfigs = useMemo(
    () => ({
      '1D': { interval: '1m', period: '1d' },
      '5D': { interval: '5m', period: '5d' },
      '1M': { interval: '1h', period: '1mo' },
      '6M': { interval: '1d', period: '6mo' },
      '1Y': { interval: '1d', period: '1y' },
    }),
    []
  );

  const wsBaseUrl = useMemo(() => {
    const httpBase = axios.defaults.baseURL || 'http://localhost:8000';
    try {
      const url = new URL(httpBase);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${url.protocol}//${url.host}`;
    } catch {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.hostname}:8000`;
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#cbd5e1',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.15)',
      },
      crosshair: {
        vertLine: { color: 'rgba(59, 130, 246, 0.4)' },
        horzLine: { color: 'rgba(59, 130, 246, 0.4)' },
      },
      height,
    });

    const seriesOptions =
      chartType === 'candlestick'
        ? {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
          }
        : {
            lineColor: '#3b82f6',
            topColor: 'rgba(59, 130, 246, 0.4)',
            bottomColor: 'rgba(59, 130, 246, 0.0)',
            lineWidth: 2,
          };

    const series =
      chartType === 'candlestick'
        ? chart.addSeries(CandlestickSeries, seriesOptions)
        : chart.addSeries(AreaSeries, seriesOptions);

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [symbol, height, chartType]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (typeof series.setMarkers !== 'function') return;
    series.setMarkers(markers);
  }, [markers]);

  useEffect(() => {
    let ws;
    let cancelled = false;

    const load = async () => {
      const config = timeframeConfigs[timeframe];
      try {
        const resp = await axios.get(`/trading/stocks/${symbol}/candles?interval=${config.interval}&period=${config.period}`);
        if (cancelled) return;
        const candles = (resp.data || []).map((c) => {
          if (chartType === 'area') {
            return { time: c.time, value: c.close };
          }
          return {
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          };
        });
        seriesRef.current?.setData(candles);
        if (candles.length > 0) {
          lastBarRef.current = candles[candles.length - 1];
          const barsToShow = timeframe === '1D' ? 120 : 60;
          const to = candles.length - 1;
          const from = Math.max(0, to - barsToShow);
          const ts = chartRef.current?.timeScale();
          if (ts?.setVisibleLogicalRange) ts.setVisibleLogicalRange({ from, to });
          else ts?.fitContent?.();
          ts?.scrollToRealTime?.();
        }
      } catch {
        seriesRef.current?.setData([]);
      }

      const token = localStorage.getItem('token') || '';
      ws = new WebSocket(`${wsBaseUrl}/trading/ws/price?token=${encodeURIComponent(token)}&symbols=${encodeURIComponent(symbol)}&simulate=true`);
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message?.type !== 'prices') return;
          const info = (message.data || []).find((x) => x.symbol === symbol);
          if (!info) return;

          const price = Number(info.price);
          if (!Number.isFinite(price)) return;
          if (typeof onPrice === 'function') onPrice(price);

          // Only update real-time candles for 1D timeframe
          if (timeframe !== '1D') return;

          const now = Math.floor(Date.now() / 1000);
          const candleTime = now - (now % 60);

          const last = lastBarRef.current;
          if (!last || last.time !== candleTime) {
            const open = last ? (chartType === 'area' ? last.value : last.close) : price;
            const bar =
              chartType === 'area'
                ? { time: candleTime, value: price }
                : { time: candleTime, open, high: Math.max(open, price), low: Math.min(open, price), close: price };
            lastBarRef.current = bar;
            seriesRef.current?.update(bar);
          } else {
            const bar =
              chartType === 'area'
                ? { time: candleTime, value: price }
                : {
                    time: candleTime,
                    open: last.open,
                    high: Math.max(last.high, price),
                    low: Math.min(last.low, price),
                    close: price,
                  };
            lastBarRef.current = bar;
            seriesRef.current?.update(bar);
          }
          chartRef.current?.timeScale().scrollToRealTime();
        } catch {
          return;
        }
      };
    };

    load();

    return () => {
      cancelled = true;
      if (ws) ws.close();
    };
  }, [symbol, wsBaseUrl, timeframe, chartType, onPrice, timeframeConfigs]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        {/* Timeframe Selectors */}
        <div className="flex items-center bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
          {Object.keys(timeframeConfigs).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                timeframe === tf ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart Type Selectors */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartType('candlestick')}
            className={`p-2 rounded-lg border transition-all ${
              chartType === 'candlestick' ? 'bg-slate-700 border-slate-500 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'
            }`}
            title="Candlestick Chart"
          >
            <BarChart2 size={16} />
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`p-2 rounded-lg border transition-all ${
              chartType === 'area' ? 'bg-slate-700 border-slate-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'
            }`}
            title="Area Chart"
          >
            <TrendingUp size={16} />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="w-full" />
    </div>
  );
};

export default CandlestickChart;
