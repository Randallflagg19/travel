/// <reference types="jest" />
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { DbService } from '../db/db.service';
import { CloudinaryService } from './cloudinary.service';
import { publicationBody } from './media-contract';
import { MediaService } from './media.service';

const user = '00000000-0000-4000-8000-000000000010';
const sessionId = '00000000-0000-4000-8000-000000000020';
const uploadId = '00000000-0000-4000-8000-000000000030';
const postId = '00000000-0000-4000-8000-000000000040';
const session = {
  id: sessionId,
  user_id: user,
  environment: 'test',
  state: 'OPEN',
  expired: false,
  post_id: null,
  publication_hash: null,
};
const upload = {
  id: uploadId,
  session_id: sessionId,
  media_type: 'PHOTO',
  ready: true,
  public_id: `travel/test/${user}/${sessionId}/${uploadId}`,
  resource_type: 'image',
  cloud_name: 'demo',
  media_url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
  media_width: 100,
  media_height: 80,
};

function setup(results: unknown[][]) {
  const queue = [...results];
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join('?'), values });
    return Promise.resolve(queue.shift() ?? []);
  });
  const begin = jest.fn((callback: (sql: unknown) => unknown) =>
    Promise.resolve(callback(sql)),
  );
  Object.assign(sql, { begin, array: (value: unknown) => value });
  const cloud = {
    getClientConfig: jest.fn(() => ({ cloudName: 'demo', apiKey: 'key' })),
    signUpload: jest.fn(() => ({ signature: 'signature', timestamp: 1 })),
    getUploadResource: jest.fn(),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: (key: string) => (key === 'MEDIA_ENVIRONMENT' ? 'test' : undefined),
  };
  const service = new MediaService(
    { client: sql } as unknown as DbService,
    cloud as unknown as CloudinaryService,
    config as ConfigService,
  );
  return { service, cloud, calls, begin };
}

describe('Media publication contract', () => {
  it.each([
    null,
    {},
    { uploadIds: [] },
    { uploadIds: Array(11).fill(uploadId) },
    { uploadIds: [uploadId, uploadId] },
    { uploadIds: ['bad'] },
    { uploadIds: [uploadId], title: 123 },
  ])(
    'rejects an invalid publication before opening a transaction: %j',
    async (body) => {
      const { service, begin } = setup([]);
      await expect(
        service.publish(sessionId, user, body),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(begin).not.toHaveBeenCalled();
    },
  );

  it('does not create a partial publication when any selected upload is missing', async () => {
    const other = '00000000-0000-4000-8000-000000000031';
    const { service, calls } = setup([[session], [upload]]);
    await expect(
      service.publish(sessionId, user, { uploadIds: [uploadId, other] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calls.some((call) => call.text.includes('INSERT INTO posts'))).toBe(
      false,
    );
  });

  it('stores the chosen order and first-file cover inside one transaction', async () => {
    const second = {
      ...upload,
      id: '00000000-0000-4000-8000-000000000031',
      public_id: 'second',
      media_type: 'VIDEO',
    };
    const { service, calls, begin } = setup([
      [session],
      [upload, second],
      [{ id: postId }],
    ]);
    await expect(
      service.publish(sessionId, user, {
        uploadIds: [second.id, uploadId],
        country: 'Thailand',
      }),
    ).resolves.toEqual({ postId });
    expect(begin).toHaveBeenCalledTimes(1);
    const insertion = calls.find((call) =>
      call.text.includes('INSERT INTO posts'),
    )!;
    expect(insertion.values).toContain('VIDEO');
    expect(insertion.values).toContain('second');
    const attachments = calls.filter((call) =>
      call.text.includes('INSERT INTO post_media'),
    );
    expect(attachments.map((call) => call.values[0])).toEqual([
      second.id,
      uploadId,
    ]);
    expect(attachments.map((call) => call.values[3])).toEqual([0, 1]);
  });

  it('returns the same publication on a retry after a lost response, without inserting again', async () => {
    const body = { uploadIds: [uploadId], title: 'Trip' };
    const hash = createHash('sha256')
      .update(JSON.stringify(publicationBody(body)))
      .digest('hex');
    const { service, calls } = setup([
      [
        {
          ...session,
          state: 'PUBLISHED',
          post_id: postId,
          publication_hash: hash,
        },
      ],
      [{ id: postId }],
    ]);
    await expect(service.publish(sessionId, user, body)).resolves.toEqual({
      postId,
    });
    expect(calls.some((call) => call.text.includes('INSERT'))).toBe(false);
  });

  it('rejects different content under a published key', async () => {
    const { service } = setup([
      [
        {
          ...session,
          state: 'PUBLISHED',
          post_id: postId,
          publication_hash: 'other',
        },
      ],
    ]);
    await expect(
      service.publish(sessionId, user, { uploadIds: [uploadId] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks another user before accessing Cloudinary', async () => {
    const { service, cloud } = setup([[session]]);
    await expect(
      service.complete(sessionId, uploadId, postId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cloud.getUploadResource).not.toHaveBeenCalled();
  });

  it('recovers a previously uploaded file using its reserved public ID', async () => {
    const { service, cloud } = setup([
      [session],
      [{ ...upload, ready: false }],
      [session],
    ]);
    cloud.getUploadResource.mockResolvedValue({
      public_id: upload.public_id,
      resource_type: 'image',
      secure_url: upload.media_url,
      format: 'jpg',
      bytes: 1000,
      width: 100,
      height: 80,
    });
    await expect(service.complete(sessionId, uploadId, user)).resolves.toEqual({
      ready: true,
    });
    expect(cloud.getUploadResource).toHaveBeenCalledWith(
      upload.public_id,
      'image',
    );
  });

  it('does not discard published files when cancelling after a lost publish response', async () => {
    const { service, calls } = setup([
      [{ ...session, state: 'PUBLISHED', post_id: postId }],
    ]);
    await expect(service.cancel(sessionId, user)).resolves.toEqual({ postId });
    expect(calls.some((call) => call.text.includes('media_deletions'))).toBe(
      false,
    );
  });
});

describe('Durable media deletion', () => {
  it('checks AUTHOR ownership before deleting the publication or touching Cloudinary', async () => {
    const { service, cloud, calls } = setup([[{ user_id: postId }]]);
    await expect(
      service.deletePost(postId, { sub: user, role: 'AUTHOR' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cloud.destroy).not.toHaveBeenCalled();
    expect(calls.some((call) => call.text.includes('DELETE FROM posts'))).toBe(
      false,
    );
  });

  it('queues every attachment before removing the post', async () => {
    const resources = ['first', 'second', 'third'].map((name) => ({
      cloud_name: 'demo',
      public_id: `travel/test/${name}`,
      resource_type: name === 'second' ? 'video' : 'image',
      media_url: upload.media_url,
    }));
    const { service, calls } = setup([
      [{ user_id: user, cloudinary_public_id: null }],
      resources,
      [],
      [],
      [],
      [],
      [],
      [],
      [{ count: 3 }],
    ]);
    await service.deletePost(postId, { sub: user, role: 'ADMIN' });
    const queues = calls.filter((call) =>
      call.text.includes('INSERT INTO media_deletions'),
    );
    expect(queues).toHaveLength(3);
    const removal = calls.findIndex((call) =>
      call.text.includes('DELETE FROM posts'),
    );
    expect(
      calls
        .slice(0, removal)
        .filter((call) => call.text.includes('INSERT INTO media_deletions')),
    ).toHaveLength(3);
  });

  it('retains a failed Cloudinary deletion with an error and next retry time', async () => {
    const job = {
      id: postId,
      cloud_name: 'demo',
      public_id: 'travel/test/file',
      resource_type: 'image',
      attempts: 0,
    };
    const { service, cloud, calls } = setup([[], [job], []]);
    cloud.destroy.mockRejectedValue(new Error('Temporary failure'));
    await service.retryCleanup();
    const retry = calls.find((call) =>
      call.text.includes('attempts = attempts + 1'),
    )!;
    expect(retry.values).toContain('Temporary failure');
    expect(retry.values).toContain(30);
    expect(
      calls.some((call) => call.text.includes('DELETE FROM media_deletions')),
    ).toBe(false);
  });

  it('never deletes a resource still used by another publication', async () => {
    const job = {
      id: postId,
      cloud_name: 'demo',
      public_id: 'travel/test/file',
      resource_type: 'image',
      attempts: 0,
    };
    const { service, cloud } = setup([[], [job], [{ exists: 1 }]]);
    await service.retryCleanup();
    expect(cloud.destroy).not.toHaveBeenCalled();
  });

  it('blocks deletion of production files from a staging/test copy before queuing anything', async () => {
    const { service, cloud, calls } = setup([
      [{ user_id: user, cloudinary_public_id: null }],
      [
        {
          cloud_name: 'demo',
          public_id: 'travel/production/file',
          resource_type: 'image',
          media_url: upload.media_url,
        },
      ],
    ]);
    await expect(
      service.deletePost(postId, { sub: user, role: 'ADMIN' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(cloud.destroy).not.toHaveBeenCalled();
    expect(
      calls.some((call) => call.text.includes('INSERT INTO media_deletions')),
    ).toBe(false);
    expect(calls.some((call) => call.text.includes('DELETE FROM posts'))).toBe(
      false,
    );
  });

  it('cleans all reservations of an abandoned session, including uploads whose response was lost', async () => {
    const { service, calls } = setup([[{ id: sessionId }], [], []]);
    await service.retryCleanup();
    const cancellation = calls.find((call) =>
      call.text.includes("SET state = 'CANCELLED'"),
    )!;
    expect(cancellation.text).toContain('expires_at <= now()');
    const queued = calls.find((call) =>
      call.text.includes('INSERT INTO media_deletions'),
    )!;
    expect(queued.values).toContain(sessionId);
    expect(queued.text).not.toContain('ready = true');
  });
});
