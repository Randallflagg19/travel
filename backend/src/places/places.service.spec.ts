/// <reference types="jest" />
import { DbService } from '../db/db.service';
import { PlacesService } from './places.service';

it('keeps publication counts separate from file counts and includes unlocated media in journal totals', async () => {
  const rows = [
    {
      country: 'Thailand',
      city: 'Chiang Mai',
      count: 1,
      photos: 2,
      videos: 1,
      stories: 0,
    },
    {
      country: 'Thailand',
      city: null,
      count: 1,
      photos: 0,
      videos: 0,
      stories: 1,
    },
    { country: null, city: null, count: 1, photos: 3, videos: 0, stories: 0 },
  ];
  const sql = jest.fn().mockResolvedValue(rows);
  const service = new PlacesService({ client: sql } as unknown as DbService);
  const places = await service.listPlaces();
  expect(places.countries[0].stats).toEqual({
    posts: 2,
    photos: 2,
    videos: 1,
    stories: 1,
  });
  expect(places.countries[0].cities[0].stats).toEqual({
    posts: 1,
    photos: 2,
    videos: 1,
    stories: 0,
  });
  expect(places.totals).toEqual({ posts: 3, photos: 5, videos: 1, stories: 1 });
});
