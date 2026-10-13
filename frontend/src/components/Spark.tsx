import { useEffect, useRef } from 'react';

// Canvas sparkline — copied spark() from backend/static/index.html
export default function Spark({ data }: { data: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width;
    const H = c.height;
    ctx.clearRect(0, 0, W, H);
    if (data.length < 2) return;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = 4 + (i / (data.length - 1)) * (W - 8);
      const y = 6 + (1 - (v - min) / span) * (H - 12);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = '#1a5c4c';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }, [data]);

  return <canvas className="spark" ref={ref} width={220} height={56} />;
}
