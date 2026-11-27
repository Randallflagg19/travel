import { createHash } from 'crypto';

export type MediaAlbum = {
  id: string;
  title: string;
  country: string;
  cities: string[];
};

const countryCodes = new Map<string, string>();
const regionNames = ['en', 'ru'].map(
  (locale) =>
    new Intl.DisplayNames(locale, { type: 'region', fallback: 'none' }),
);
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
for (const first of alphabet) {
  for (const second of alphabet) {
    const code = first + second;
    for (const display of regionNames) {
      const name = display.of(code);
      if (name) {
        countryCodes.set(name.toLowerCase(), code);
        countryCodes.set(code.toLowerCase(), code);
      }
    }
  }
}

export function albumFolderParts(
  username: string,
  userId: string,
  country: string,
  title: string,
  environment: string,
) {
  const leaf = Array.from(
    title
      .normalize('NFC')
      .replace(/[?&#\\%<>+/\p{C}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, 80)
    .join('')
    .trim();
  return {
    ownerFolder: mediaOwnerFolder(username, userId, environment),
    countryCode: mediaCountryFolder(country),
    titleFolder: folderSegment(leaf, 'Альбом'),
  };
}

export function mediaCountryFolder(country: string) {
  const countryName = country.trim().toLowerCase();
  // Imported countries may use a custom label. Keep their paths stable and safe.
  return (
    countryCodes.get(countryName) ??
    `country-${createHash('sha256').update(countryName).digest('hex').slice(0, 16)}`
  );
}

export function mediaOwnerFolder(
  username: string,
  userId: string,
  environment: string,
) {
  const login = username.toLowerCase();
  const segment = folderSegment(
    login.replace(/[^a-z0-9._-]/g, '-').slice(0, 32),
    'author',
  );
  const owner = segment === login ? login : `${segment}~${userId}`;
  return environment === 'development' ? owner : `${owner}~${environment}`;
}

function folderSegment(value: string, fallback: string) {
  if (!value || value === '.' || value === '..') return fallback;
  // Cloudinary treats version-like path components as part of the delivery URL.
  return /^v\d/i.test(value) ? `_${value}` : value;
}

export function albumCountryLabel(country: string) {
  const code = countryCodes.get(country.trim().toLowerCase());
  return code ? (regionNames[1].of(code) ?? country) : country;
}
