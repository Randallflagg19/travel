import { ServiceUnavailableException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { CloudinaryCatalogService } from '../integrations/cloudinary/cloudinary-catalog.service';
import { CloudinaryImportService } from './cloudinary-import.service';
import { MediaDimensionsBackfillService } from './media-dimensions-backfill.service';

function setup(results: unknown[][]) {
  const queue = [...results];
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join('?'), values });
    return Promise.resolve(queue.shift() ?? []);
  });
  const db = { client: sql } as unknown as DbService;
  const cloud = {
    getClientConfig: jest.fn(),
    buildMediaUrl: jest.fn(() => 'https://example.test/photo.jpg'),
    getResourceMetadata: jest.fn().mockResolvedValue({
      lat: 13.75,
      lng: 100.5,
      shotAt: new Date('2026-01-19T06:18:00Z'),
      width: 1200,
      height: 800,
    }),
  };
  const catalog = {
    listSubFoldersBfs: jest.fn().mockResolvedValue(['tapir/Thailand/Bangkok']),
    listByAssetFolder: jest
      .fn()
      .mockImplementation((params: { resourceType: string }) =>
        Promise.resolve({
          resources:
            params.resourceType === 'image'
              ? [
                  {
                    public_id: 'tapir/Thailand/Bangkok/photo',
                    resource_type: 'image',
                    asset_folder: 'tapir/Thailand/Bangkok',
                  },
                ]
              : [],
        }),
      ),
    resourcesByIds: jest.fn(),
  };
  const storage = cloud as unknown as CloudinaryService;
  const library = catalog as unknown as CloudinaryCatalogService;
  return {
    importer: new CloudinaryImportService(db, storage, library),
    dimensions: new MediaDimensionsBackfillService(db, storage, library),
    calls,
    cloud,
    catalog,
  };
}

describe('Existing media import', () => {
  it('never reimports a carousel attachment, reserved upload or pending deletion', async () => {
    const { importer, calls, cloud } = setup([[{ reserved: 1 }]]);
    await expect(
      importer.importPrefix({ prefix: 'tapir/', userId: 'author' }),
    ).resolves.toMatchObject({ scanned: 1, inserted: 0, errors: [] });
    expect(calls).toHaveLength(1);
    for (const table of ['post_media', 'media_uploads', 'media_deletions']) {
      expect(calls[0].text).toContain(`FROM ${table}`);
    }
    expect(cloud.getResourceMetadata).not.toHaveBeenCalled();
  });

  it('preserves folder location, shooting time, GPS and dimensions when importing', async () => {
    const { importer, calls } = setup([[], [{ id: 'new-post' }]]);
    await expect(
      importer.importPrefix({ prefix: 'tapir/', userId: 'author' }),
    ).resolves.toMatchObject({ inserted: 1, errors: [] });
    const insertion = calls.find((call) =>
      call.text.includes('INSERT INTO posts'),
    )!;
    expect(insertion.values).toEqual([
      'author',
      'PHOTO',
      'https://example.test/photo.jpg',
      'tapir/Thailand/Bangkok/photo',
      'tapir/Thailand/Bangkok',
      'Thailand',
      'Bangkok',
      13.75,
      100.5,
      '2026-01-19T06:18:00.000Z',
      1200,
      800,
    ]);
    expect(insertion.text).toContain(
      'ON CONFLICT (cloudinary_public_id) WHERE cloudinary_public_id IS NOT NULL DO NOTHING',
    );
  });

  it('reports a folder lookup failure while continuing with other resource types', async () => {
    const { importer, catalog } = setup([]);
    catalog.listByAssetFolder.mockRejectedValueOnce(new Error('Rate limit'));
    await expect(
      importer.importPrefix({ prefix: 'tapir/', userId: 'author' }),
    ).resolves.toMatchObject({
      errors: [
        { stage: 'list', resource_type: 'image', message: 'Rate limit' },
      ],
    });
    expect(catalog.listByAssetFolder).toHaveBeenCalledTimes(3);
  });
});

describe('Media dimensions backfill', () => {
  it('leaves all rows retryable when any Cloudinary batch fails', async () => {
    const { dimensions, catalog, calls } = setup([
      [
        { id: 'photo', cloudinary_public_id: 'photo', media_type: 'PHOTO' },
        { id: 'video', cloudinary_public_id: 'video', media_type: 'VIDEO' },
      ],
    ]);
    catalog.resourcesByIds.mockResolvedValueOnce([
      { public_id: 'photo', width: 1200, height: 800 },
    ]);
    catalog.resourcesByIds.mockRejectedValueOnce(
      new ServiceUnavailableException('Rate limit'),
    );
    await expect(dimensions.backfillMediaDimensions()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(calls).toHaveLength(1);
  });

  it('distinguishes recovered dimensions from files missing in Cloudinary', async () => {
    const { dimensions, catalog, calls } = setup([
      [
        { id: 'photo', cloudinary_public_id: 'photo', media_type: 'PHOTO' },
        { id: 'missing', cloudinary_public_id: 'missing', media_type: 'PHOTO' },
      ],
    ]);
    catalog.resourcesByIds.mockResolvedValue([
      { public_id: 'photo', width: 1200, height: 800 },
    ]);
    await expect(dimensions.backfillMediaDimensions()).resolves.toEqual({
      scanned: 2,
      updated: 1,
      unavailable: 1,
      hasMore: false,
    });
    expect(calls[1].values).toEqual([1200, 800, 'photo']);
    expect(calls[2].values).toEqual([null, null, 'missing']);
  });
});
