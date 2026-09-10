import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

type PlaceRow = {
  country: string | null;
  city: string | null;
  count: number;
  photos: number;
  videos: number;
  stories: number;
};

type PostTypeStats = {
  posts: number;
  photos: number;
  videos: number;
  stories: number;
};

type CityPlace = { city: string; count: number; stats: PostTypeStats };

type CountryPlace = {
  country: string;
  cities: CityPlace[];
  count: number;
  stats: PostTypeStats;
};

export type PlacesResponse = {
  countries: CountryPlace[];
};

@Injectable()
export class PlacesService {
  constructor(private readonly db: DbService) {}

  async listPlaces(): Promise<PlacesResponse> {
    if (!this.db.client) return { countries: [] };

    const rows = await this.db.client<PlaceRow[]>`
      SELECT
        NULLIF(TRIM(country), '') AS country,
        NULLIF(TRIM(city), '') AS city,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE media_type = 'PHOTO')::int AS photos,
        COUNT(*) FILTER (WHERE media_type = 'VIDEO')::int AS videos,
        COUNT(*) FILTER (WHERE media_type = 'STORY')::int AS stories
      FROM posts
      GROUP BY 1, 2
      ORDER BY 1 NULLS LAST, 2 NULLS LAST
    `;

    const countriesMap = new Map<string, CountryPlace>();

    for (const r of rows) {
      const hasCountry = Boolean(r.country);
      const hasCity = Boolean(r.city);

      if (!hasCountry) {
        continue;
      }

      const country = r.country as string;
      const existing = countriesMap.get(country) ?? {
        country,
        cities: [],
        count: 0,
        stats: { posts: 0, photos: 0, videos: 0, stories: 0 },
      };

      if (hasCity) {
        existing.cities.push({
          city: r.city as string,
          count: r.count,
          stats: {
            posts: r.count,
            photos: r.photos,
            videos: r.videos,
            stories: r.stories,
          },
        });
      }

      existing.count += r.count;
      existing.stats.posts += r.count;
      existing.stats.photos += r.photos;
      existing.stats.videos += r.videos;
      existing.stats.stories += r.stories;
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
    };
  }
}
