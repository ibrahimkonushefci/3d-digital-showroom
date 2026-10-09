export type Point = { x: number; y: number };
export type Corners = [Point, Point, Point, Point];
export function validCorners(points: Corners) {
  let sign = 0;
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = points[i],
      b = points[(i + 1) % 4],
      c = points[(i + 2) % 4];
    if (
      !Number.isFinite(a.x) ||
      !Number.isFinite(a.y) ||
      a.x < 0 ||
      a.x > 1 ||
      a.y < 0 ||
      a.y > 1
    )
      return false;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 0.0001) return false;
    if (sign && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2 > 0.002;
}
export function homography(points: Corners) {
  if (!validCorners(points)) throw Error("cornerError");
  const uv = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    a: number[][] = [];
  points.forEach((p, i) => {
    const [x, y] = uv[i];
    a.push([x, y, 1, 0, 0, 0, -p.x * x, -p.x * y, p.x]);
    a.push([0, 0, 0, x, y, 1, -p.y * x, -p.y * y, p.y]);
  });
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++)
      if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    if (Math.abs(a[c][c]) < 1e-12) throw Error("cornerError");
    const v = a[c][c];
    for (let j = c; j <= 8; j++) a[c][j] /= v;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = a[r][c];
      for (let j = c; j <= 8; j++) a[r][j] -= f * a[c][j];
    }
  }
  return [...a.map((r) => r[8]), 1];
}
export function transform(matrix: number[], point: Point) {
  const [a, b, c, d, e, f, g, h, i] = matrix,
    q = g * point.x + h * point.y + i;
  return {
    x: (a * point.x + b * point.y + c) / q,
    y: (d * point.x + e * point.y + f) / q,
  };
}
export function inverse(m: number[]) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) throw Error("cornerError");
  return [
    (e * i - f * h) / det,
    (c * h - b * i) / det,
    (b * f - c * e) / det,
    (f * g - d * i) / det,
    (a * i - c * g) / det,
    (c * d - a * f) / det,
    (d * h - e * g) / det,
    (b * g - a * h) / det,
    (a * e - b * d) / det,
  ];
}
