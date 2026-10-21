export type CropRect = { x: number; y: number; width: number; height: number };

export function normalizeRotation(rotation: number): number {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  return normalized;
}

export function clampCrop(crop: CropRect | undefined, sourceWidth: number, sourceHeight: number): CropRect {
  const full = { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  if (!crop || sourceWidth < 1 || sourceHeight < 1) return full;
  const x = Math.max(0, Math.min(Math.floor(crop.x), sourceWidth - 1));
  const y = Math.max(0, Math.min(Math.floor(crop.y), sourceHeight - 1));
  const width = Math.max(1, Math.min(Math.floor(crop.width), sourceWidth - x));
  const height = Math.max(1, Math.min(Math.floor(crop.height), sourceHeight - y));
  return { x, y, width, height };
}

export function fitDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  keepAspect: boolean,
): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.min(12000, Math.round(targetWidth)));
  const safeHeight = Math.max(1, Math.min(12000, Math.round(targetHeight)));
  if (!keepAspect || sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: safeWidth, height: safeHeight };
  }
  const scale = Math.min(safeWidth / sourceWidth, safeHeight / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}
