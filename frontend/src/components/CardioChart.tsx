import { Chart } from 'chart.js/auto';
import { useEffect, useRef } from 'react';
import type { CardioPoint } from '../lib/useCardio';

// Chart.js telemetry chart — same datasets/axes/options as backend/static/index.html
export default function CardioChart({ points }: { points: CardioPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const GRID = '#e7edeb';
    const TICK = '#7a8f8a';
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Heart rate (bpm)',
            data: [],
            borderColor: '#b4232a',
            backgroundColor: 'rgba(180,35,42,0.07)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 3,
            yAxisID: 'y',
          },
          {
            label: 'SpO2 (%)',
            data: [],
            borderColor: '#1a5c4c',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 4],
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 3,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { color: GRID },
            ticks: { color: TICK, font: { size: 11 }, maxTicksLimit: 6 },
          },
          y: {
            type: 'linear',
            position: 'left',
            min: 40,
            max: 130,
            grid: { color: GRID },
            ticks: { color: TICK, font: { size: 11 }, maxTicksLimit: 6 },
          },
          y1: {
            type: 'linear',
            position: 'right',
            min: 75,
            max: 100,
            grid: { drawOnChartArea: false },
            ticks: { color: TICK, font: { size: 11 }, maxTicksLimit: 5 },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#4b5f5a', font: { size: 12 }, boxWidth: 16, boxHeight: 3, padding: 14 },
          },
        },
      },
    });
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data.labels = points.map((p) =>
      new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
    chart.data.datasets[0].data = points.map((p) => p.hr);
    chart.data.datasets[1].data = points.map((p) => p.spo2);
    chart.update('none');
  }, [points]);

  return <canvas ref={canvasRef} />;
}
