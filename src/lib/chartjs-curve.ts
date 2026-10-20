import type { CurveType } from 'recharts/types/shape/Curve';

type Point = { x: number; y: number };

interface PathContext {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
}

const TENSION = 0.4;

function controlPoints(prev: Point, current: Point, next: Point) {
  const d01 = Math.hypot(current.x - prev.x, current.y - prev.y);
  const d12 = Math.hypot(next.x - current.x, next.y - current.y);
  const total = d01 + d12;
  const fa = total ? (TENSION * d01) / total : 0;
  const fb = total ? (TENSION * d12) / total : 0;
  return {
    before: { x: current.x - fa * (next.x - prev.x), y: current.y - fa * (next.y - prev.y) },
    after: { x: current.x + fb * (next.x - prev.x), y: current.y + fb * (next.y - prev.y) },
  };
}

function chartJsCurve(context: PathContext) {
  let points: Point[] = [];
  return {
    areaStart() {},
    areaEnd() {},
    lineStart() {
      points = [];
    },
    point(x: number, y: number) {
      points.push({ x: Number(x), y: Number(y) });
    },
    lineEnd() {
      const [first] = points;
      if (!first) return;
      context.moveTo(first.x, first.y);
      if (points.length === 1) return;
      const controls = points.map((p, i) => controlPoints(points[i - 1] ?? p, p, points[i + 1] ?? p));
      for (let i = 1; i < points.length; i += 1) {
        const from = controls[i - 1]!.after;
        const to = controls[i]!.before;
        const p = points[i]!;
        context.bezierCurveTo(from.x, from.y, to.x, to.y, p.x, p.y);
      }
    },
  };
}

export const CHARTJS_CURVE = chartJsCurve as unknown as CurveType;
