/** Парсит GPS из формата Cloudinary EXIF: "13 deg 45' 10.78\" N" → десятичные градусы. */
export function parseGpsCoord(value: string | undefined): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const m = value.trim().match(/(\d+)\s*deg\s*(\d+)'\s*([\d.]+)"\s*([NSEW])/i);
  if (!m) return null;
  const [, d, min, sec, dir] = m;
  const deg = parseInt(d ?? '0', 10);
  const minVal = parseInt(min ?? '0', 10) / 60;
  const secVal = parseFloat(sec ?? '0') / 3600;
  let dec = deg + minVal + secVal;
  if ((dir ?? '').toUpperCase() === 'S' || (dir ?? '').toUpperCase() === 'W')
    dec = -dec;
  return Math.round(dec * 1e7) / 1e7;
}

/** Парсит дату съёмки: "2026:01:19 13:18:00" (локаль + offset) или "UTC 2026-01-23 03:09:16". */
export function parseShotDate(
  dateStr: string | undefined,
  offsetStr?: string | null,
): Date | null {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return null;
  const normalized = dateStr.replace(/-/g, ':').trim();
  const m = normalized.match(
    /(?:UTC\s+)?(\d{4}):(\d{2}):(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})/,
  );
  if (!m) return null;
  const [, y, mo, d, h, min, sec] = m;
  let offsetMinutes = 0;
  if (typeof offsetStr === 'string' && offsetStr.trim()) {
    const om = offsetStr.trim().match(/^([+-])(\d{2}):(\d{2})$/);
    if (om) {
      const sign = om[1] === '+' ? 1 : -1;
      offsetMinutes = sign * (parseInt(om[2], 10) * 60 + parseInt(om[3], 10));
    }
  }
  const date = new Date(
    Date.UTC(
      parseInt(y ?? '0', 10),
      parseInt(mo ?? '0', 10) - 1,
      parseInt(d ?? '0', 10),
      parseInt(h ?? '0', 10),
      parseInt(min ?? '0', 10),
      parseInt(sec ?? '0', 10),
    ),
  );
  if (offsetMinutes !== 0) {
    date.setTime(date.getTime() - offsetMinutes * 60 * 1000);
  }
  return date;
}

export type ResourceMetadata = {
  lat: number | null;
  lng: number | null;
  shotAt: Date | null;
  width: number | null;
  height: number | null;
};

export function asPositiveDimension(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

export function dimensionsFromValues(
  width: unknown,
  height: unknown,
): { width: number; height: number } | null {
  const normalizedWidth = asPositiveDimension(width);
  const normalizedHeight = asPositiveDimension(height);
  return normalizedWidth != null && normalizedHeight != null
    ? { width: normalizedWidth, height: normalizedHeight }
    : null;
}
