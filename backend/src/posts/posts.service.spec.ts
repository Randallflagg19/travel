/// <reference types="jest" />

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MediaService } from '../cloudinary/media.service';
import { DbService } from '../db/db.service';
import { PostRow, PostsService } from './posts.service';

type SqlCall = {
  text: string;
  values: unknown[];
};

function makePost(overrides: Partial<PostRow> = {}): PostRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    user_id: '00000000-0000-4000-8000-000000000010',
    media_type: 'PHOTO',
    media_url: 'https://example.com/photo.jpg',
    cloudinary_public_id: 'travel/photo',
    folder: 'travel/Thailand/Bangkok',
    text: null,
    title: null,
    layout: 'STANDARD',
    media_width: 1200,
    media_height: 800,
    country: 'Thailand',
    city: 'Bangkok',
    lat: null,
    lng: null,
    pinned_at: null,
    created_at: '2026-09-20T07:00:00.000Z',
    like_count: 0,
    comment_count: 0,
    liked_by_me: false,
    ...overrides,
  };
}

function createService(results: PostRow[][]) {
  const calls: SqlCall[] = [];
  const queuedResults = [...results];
  const sql = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join('?'), values });
    return Promise.resolve(queuedResults.shift() ?? []);
  });
  Object.assign(sql, { array: jest.fn((values: unknown[]) => values) });

  const db = { client: sql } as unknown as DbService;
  const cloud = {} as CloudinaryService;
  const deletePost = jest.fn().mockResolvedValue({ pendingMediaDeletions: 0 });
  const media = { deletePost } as unknown as MediaService;
  return {
    service: new PostsService(db, cloud, media),
    calls,
    sql,
    deletePost,
  };
}

function decodeCursor(cursor: string): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(cursor, 'base64url').toString('utf8'),
  ) as Record<string, unknown>;
}

describe('PostsService pinning', () => {
  it('pins a post and returns its timestamp', async () => {
    const pinnedAt = '2026-09-20T07:15:00.000Z';
    const post = makePost({ pinned_at: pinnedAt });
    const { service, calls } = createService([[post], [post], []]);

    await expect(service.setPinned(post.id, true)).resolves.toEqual(post);

    expect(calls).toHaveLength(3);
    expect(calls[0]?.text).toContain(
      'SET pinned_at = CASE WHEN ?::boolean THEN now() ELSE NULL END',
    );
    expect(calls[0]?.values).toContain(true);
    expect(calls[0]?.values).toContain(post.id);
  });

  it('unpins a post', async () => {
    const post = makePost({ pinned_at: null });
    const { service, calls } = createService([[post], [post], []]);

    await expect(service.setPinned(post.id, false)).resolves.toEqual(post);

    expect(calls[0]?.values).toContain(false);
  });

  it('rejects a missing pinned flag before querying the database', async () => {
    const { service, sql } = createService([]);

    await expect(
      service.setPinned(
        '00000000-0000-4000-8000-000000000001',
        undefined as unknown as boolean,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns not found when the post does not exist', async () => {
    const { service } = createService([[]]);

    await expect(
      service.setPinned('00000000-0000-4000-8000-000000000099', true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PostsService pinned pagination', () => {
  it.each([
    ['asc', 'p.created_at ASC', 'p.id ASC'],
    ['desc', 'p.created_at DESC', 'p.id DESC'],
  ] as const)(
    'keeps pinned posts first for %s chronological order',
    async (order, createdOrder, idOrder) => {
      const { service, calls } = createService([[]]);

      await service.listPage({ order });

      const query = calls[0]?.text ?? '';
      expect(query).toContain('(p.pinned_at IS NULL) ASC');
      expect(query).toContain('p.pinned_at DESC NULLS LAST');
      expect(query).toContain(createdOrder);
      expect(query).toContain(idOrder);
    },
  );

  it('encodes pinned_at in the next cursor', async () => {
    const pinnedAt = '2026-09-20T07:20:00.000Z';
    const first = makePost({ pinned_at: pinnedAt });
    const second = makePost({
      id: '00000000-0000-4000-8000-000000000002',
      pinned_at: null,
      created_at: '2026-09-19T07:00:00.000Z',
    });
    const { service } = createService([[first, second]]);

    const page = await service.listPage({ limit: 1, order: 'desc' });

    expect(page.items).toEqual([first]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor(page.nextCursor as string)).toEqual({
      pinned_at: pinnedAt,
      created_at: first.created_at,
      id: first.id,
    });
  });

  it('uses the pinned cursor and location filters on the next page', async () => {
    const pinnedAt = '2026-09-20T07:25:00.000Z';
    const cursor = Buffer.from(
      JSON.stringify({
        pinned_at: pinnedAt,
        created_at: '2026-09-20T07:00:00.000Z',
        id: '00000000-0000-4000-8000-000000000001',
      }),
      'utf8',
    ).toString('base64url');
    const { service, calls } = createService([[]]);

    await service.listPage({
      cursor,
      country: 'Thailand',
      city: 'Bangkok',
      order: 'desc',
    });

    expect(calls[0]?.values).toContain(pinnedAt);
    expect(calls[0]?.values).toContain('Thailand');
    expect(calls[0]?.values).toContain('Bangkok');
    expect(calls[0]?.text).toContain('p.pinned_at IS NULL');
    expect(calls[0]?.text).toContain('p.pinned_at < ?::timestamptz');
  });

  it('accepts an old cursor without pinned_at as an unpinned cursor', async () => {
    const oldCursor = Buffer.from(
      JSON.stringify({
        created_at: '2026-09-20T07:00:00.000Z',
        id: '00000000-0000-4000-8000-000000000001',
      }),
      'utf8',
    ).toString('base64url');
    const { service, calls } = createService([[]]);

    await expect(
      service.listPage({ cursor: oldCursor, order: 'desc' }),
    ).resolves.toBeDefined();
    expect(calls[0]?.values).toContain(null);
  });
});

describe('PostsService author isolation', () => {
  const authorId = '00000000-0000-4000-8000-000000000010';
  const otherId = '00000000-0000-4000-8000-000000000011';
  const author = { sub: authorId, role: 'AUTHOR' as const };

  it.each(['asc', 'desc'] as const)(
    'filters %s pages by author before pagination',
    async (order) => {
      const { service, calls } = createService([[]]);
      await service.listPage({ authorId, order, country: 'Thailand' });
      expect(calls[0]?.text).toContain('p.user_id = ?::uuid');
      expect(calls[0]?.values).toContain(authorId);
    },
  );

  it('prevents an author from editing another author’s post', async () => {
    const { service, calls } = createService([
      [
        {
          user_id: otherId,
          media_type: 'STORY',
          title: 'A',
          text: 'B',
        } as PostRow,
      ],
    ]);
    await expect(
      service.updateMetadata(makePost().id, { title: 'New' }, author),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(calls).toHaveLength(1);
  });

  it('restricts pin updates to the author’s posts at SQL level', async () => {
    const { service, calls } = createService([[]]);
    await expect(
      service.setPinned(makePost().id, true, author),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(calls[0]?.text).toContain('user_id = ?::uuid');
    expect(calls[0]?.values).toContain(authorId);
  });

  it('delegates deletion and its permission check to the durable media lifecycle', async () => {
    const { service, calls, deletePost } = createService([]);
    deletePost.mockRejectedValue(new ForbiddenException());
    await expect(service.delete(makePost().id, author)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(deletePost).toHaveBeenCalledWith(makePost().id, author);
    expect(calls).toHaveLength(0);
  });

  it.each(['PHOTO', 'VIDEO'] as const)(
    'blocks shared-Cloudinary %s creation for an author',
    async (mediaType) => {
      const { service, calls } = createService([]);
      await expect(
        service.create({
          userId: authorId,
          actorRole: 'AUTHOR',
          mediaType,
          mediaUrl: 'https://example.com/1.jpg',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(calls).toHaveLength(0);
    },
  );

  it('blocks authors from attaching a shared-Cloudinary asset to a story', async () => {
    const { service, calls } = createService([]);
    await expect(
      service.create({
        userId: authorId,
        actorRole: 'AUTHOR',
        mediaType: 'STORY',
        title: 'Trip',
        text: 'Story',
        cloudinaryPublicId: 'tapir/private-photo',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(calls).toHaveLength(0);
  });
});

describe('Post metadata response', () => {
  it('keeps dimension backfills of legacy single-media posts visible after migration', async () => {
    const post = makePost({ media_width: 1600, media_height: 900 });
    const legacyMedia = {
      id: 'legacy-frame',
      post_id: post.id,
      upload_id: null,
      position: 0,
      media_type: 'PHOTO',
      media_url: post.media_url,
      cloudinary_public_id: post.cloudinary_public_id,
      media_width: null,
      media_height: null,
    };
    const { service } = createService([
      [post],
      [legacyMedia as unknown as PostRow],
    ]);
    await expect(service.getOrThrow(post.id)).resolves.toMatchObject({
      attachments: [
        { id: 'legacy-frame', media_width: 1600, media_height: 900 },
      ],
    });
  });

  it('returns real reactions and my like instead of the UPDATE row', async () => {
    const existing = makePost();
    const saved = makePost({
      title: 'Updated',
      like_count: 7,
      comment_count: 3,
      liked_by_me: true,
    });
    const { service } = createService([
      [existing],
      [makePost({ title: 'Updated' })],
      [saved],
      [],
      [{ id: 'like' } as unknown as PostRow],
    ]);
    await expect(
      service.updateMetadata(
        saved.id,
        { title: 'Updated' },
        { sub: saved.user_id, role: 'ADMIN' },
      ),
    ).resolves.toMatchObject({
      title: 'Updated',
      like_count: 7,
      comment_count: 3,
      liked_by_me: true,
    });
  });

  it('rejects non-object metadata bodies without making a query', async () => {
    const { service, calls } = createService([]);
    await expect(
      service.updateMetadata(makePost().id, null as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toHaveLength(0);
  });
});
