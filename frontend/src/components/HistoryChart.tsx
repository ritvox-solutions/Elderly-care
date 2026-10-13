import { Chart } from 'chart.js/auto';
import { useEffect, useRef } from 'react';

export interface HistoryPoint {
  t: number;
  v: number;
}

// Single-metric Chart.js line — same grid/tick styling as the cardiac chart
export default function HistoryChart({
  points,
  color,
  label,
}: {
  points: HistoryPoint[];
  color: string;
  label: string;
}) {
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
            label,
            data: [],
            borderColor: color,
            backgroundColor: `${color}12`,
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 3,
            yAxisID: 'y',
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
            grid: { color: GRID },
            ticks: { color: TICK, font: { size: 11 }, maxTicksLimit: 6 },
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
  }, [color, label]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data.labels = points.map((p) =>
      new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
    chart.data.datasets[0].data = points.map((p) => p.v);
    chart.update('none');
  }, [points]);

  return <canvas ref={canvasRef} />;
}
