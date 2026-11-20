export function pluralizeRu(count: number, forms: [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function cityCountLabel(count: number) {
  return `${count} ${pluralizeRu(count, ["город", "города", "городов"])}`;
}

export function frameCountLabel(count: number) {
  return `${count} ${pluralizeRu(count, ["кадр", "кадра", "кадров"])}`;
}
