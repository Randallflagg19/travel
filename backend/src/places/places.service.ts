import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

type PlaceRow = {
  country: string | null;
  city: string | null;
  count: number;
};

export type PlacesResponse = {
  countries: Array<{
    country: string;
    cities: Array<{ city: string; count: number }>;
    count: number;
  }>;
  unknown: {
    count: number;
  };
};

@Injectable()
export class PlacesService {
  constructor(private readonly db: DbService) {}

  async listPlaces(): Promise<PlacesResponse> {
    if (!this.db.client) return { countries: [], unknown: { count: 0 } };

    const rows = await this.db.client<PlaceRow[]>`
      SELECT
        NULLIF(TRIM(country), '') AS country,
        NULLIF(TRIM(city), '') AS city,
        COUNT(*)::int AS count
      FROM posts
      GROUP BY 1, 2
      ORDER BY 1 NULLS LAST, 2 NULLS LAST
    `;

    const countriesMap = new Map<
      string,
      {
        country: string;
        cities: Array<{ city: string; count: number }>;
        count: number;
      }
    >();

    let unknownCount = 0;

    for (const r of rows) {
      const hasCountry = Boolean(r.country);
      const hasCity = Boolean(r.city);

      if (!hasCountry || !hasCity) {
        unknownCount += r.count ?? 0;
        continue;
      }

      const country = r.country as string;
      const city = r.city as string;

      const existing = countriesMap.get(country) ?? {
        country,
        cities: [],
        count: 0,
      };
      existing.cities.push({ city, count: r.count });
      existing.count += r.count;
      countriesMap.set(country, existing);
    }

    const countries = Array.from(countriesMap.values()).sort((a, b) =>
      a.country.localeCompare(b.country, 'ru'),
    );

    // Keep cities sorted alphabetically for predictable UI.
    for (const c of countries) {
      c.cities.sort((a, b) => a.city.localeCompare(b.city, 'ru'));
    }

    return {
      countries,
      unknown: { count: unknownCount },
    };
  }
}
