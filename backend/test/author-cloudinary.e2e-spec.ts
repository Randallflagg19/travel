/// <reference types="jest" />

import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { v2 as cloudinary } from 'cloudinary';
import {
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import type { Server } from 'node:http';
import postgres, { type Sql } from 'postgres';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { DbModule } from '../src/db/db.module';
import { DbService } from '../src/db/db.service';
import { runVersionedMigrations } from '../src/db/versioned-migrations';
import { PostsModule } from '../src/posts/posts.module';

const databaseUrl = process.env.AUTHOR_CLOUDINARY_TEST_DATABASE_URL;
const databaseTest = databaseUrl ? describe : describe.skip;

databaseTest('Author Cloudinary connections', () => {
  const schema = `author_cloudinary_test_${randomUUID().replaceAll('-', '')}`;
  const encryptionKey = randomBytes(32);
  const endpoint = '/api/users/me/cloudinary';
  let app: INestApplication<Server>;
  let sql: Sql;
  let jwt: JwtService;
  let schemaCreated = false;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, {
      max: 1,
      prepare: false,
      ssl:
        process.env.AUTHOR_CLOUDINARY_TEST_DB_SSL === 'disable'
          ? false
          : 'require',
    });
    await sql`CREATE SCHEMA ${sql(schema)}`;
    schemaCreated = true;
    await sql`SET search_path TO ${sql(schema)}, public`;
    await runVersionedMigrations(sql);

    const modules = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        DbModule,
        AuthModule,
        PostsModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          DB_MIGRATE_ON_START: 'false',
          JWT_SECRET: 'fixture-jwt-secret-for-author-cloudinary',
          AUTHOR_CLOUDINARY_ENCRYPTION_KEY: encryptionKey.toString('hex'),
        }),
      )
      .overrideProvider(DbService)
      .useValue({ client: sql })
      .compile();
    jwt = modules.get(JwtService);
    app = modules.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    try {
      await app?.close();
      if (schemaCreated) await sql`DROP SCHEMA ${sql(schema)} CASCADE`;
    } finally {
      await sql?.end();
    }
  });

  async function loginAs(login: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login, password })
      .expect(201);
    const { accessToken } = response.body as { accessToken: string };
    return accessToken;
  }

  it('stores a verified secret encrypted and preserves it after Cloudinary rejects a replacement', async () => {
    const authorId = randomUUID();
    await sql`
      INSERT INTO users (id, username, password_hash, role)
      VALUES (${authorId}, 'fixture-author', 'unused', 'AUTHOR')
    `;
    const token = await jwt.signAsync({ sub: authorId });
    const credentials = {
      cloudName: 'fixture-cloud',
      apiKey: 'fixture-api-key',
      apiSecret: 'fixture-api-secret',
    };
    const ping = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected Cloudinary request'))
      .mockResolvedValueOnce(Response.json({ status: 'ok' }))
      .mockResolvedValueOnce(
        Response.json(
          { error: { message: 'provider-private-error' } },
          { status: 401 },
        ),
      );

    await request(app.getHttpServer())
      .put(endpoint)
      .auth(token, { type: 'bearer' })
      .send(credentials)
      .expect(200, { connected: true, cloudName: credentials.cloudName });

    const basicAuth = Buffer.from(
      `${credentials.apiKey}:${credentials.apiSecret}`,
    ).toString('base64');
    expect(ping).toHaveBeenNthCalledWith(
      1,
      'https://api.cloudinary.com/v1_1/fixture-cloud/ping',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: `Basic ${basicAuth}` },
      }),
    );

    const [saved] = await sql<
      { cloud_name: string; api_key: string; api_secret_encrypted: string }[]
    >`
      SELECT cloud_name, api_key, api_secret_encrypted
      FROM author_cloudinary_connections WHERE user_id = ${authorId}
    `;
    expect(saved.cloud_name).toBe(credentials.cloudName);
    expect(saved.api_key).toBe(credentials.apiKey);
    expect(saved.api_secret_encrypted).not.toContain(credentials.apiSecret);
    const [version, nonce, tag, ciphertext] =
      saved.api_secret_encrypted.split('.');
    expect(version).toBe('v1');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey,
      Buffer.from(nonce, 'base64url'),
    );
    decipher.setAAD(Buffer.from(authorId));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    expect(
      Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8'),
    ).toBe(credentials.apiSecret);

    await request(app.getHttpServer())
      .put(endpoint)
      .auth(token, { type: 'bearer' })
      .send({
        cloudName: 'other-cloud',
        apiKey: 'wrong-key',
        apiSecret: 'wrong-secret',
      })
      .expect(400, {
        message: 'Cloudinary rejected the cloud name or API credentials',
        error: 'Bad Request',
        statusCode: 400,
      });
    expect(ping).toHaveBeenCalledTimes(2);
    const unchanged = await sql`
      SELECT cloud_name, api_key, api_secret_encrypted
      FROM author_cloudinary_connections WHERE user_id = ${authorId}
    `;
    expect(unchanged).toEqual([saved]);
  });

  it('reads the saved cloud after signing in again and isolates two authors on both routes', async () => {
    const authorId = randomUUID();
    const otherAuthorId = randomUUID();
    const password = 'fixture-author-password';
    const passwordHash = await argon2.hash(password);
    await sql`
      INSERT INTO users (id, username, password_hash, role)
      VALUES (${authorId}, 'connected-author', ${passwordHash}, 'AUTHOR'),
             (${otherAuthorId}, 'other-author', ${passwordHash}, 'AUTHOR')
    `;
    const ping = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected Cloudinary request'))
      .mockResolvedValueOnce(Response.json({ status: 'ok' }))
      .mockResolvedValueOnce(Response.json({ status: 'ok' }));

    const token = await loginAs('connected-author', password);
    await request(app.getHttpServer())
      .get(endpoint)
      .auth(token, { type: 'bearer' })
      .expect(200, { connected: false, cloudName: null });
    await request(app.getHttpServer())
      .put(endpoint)
      .auth(token, { type: 'bearer' })
      .send({
        cloudName: 'fixture-cloud',
        apiKey: 'fixture-api-key',
        apiSecret: 'fixture-api-secret',
      })
      .expect(200);

    const nextToken = await loginAs('connected-author', password);
    await request(app.getHttpServer())
      .get(endpoint)
      .auth(nextToken, { type: 'bearer' })
      .expect('Cache-Control', 'no-store')
      .expect(200, { connected: true, cloudName: 'fixture-cloud' });

    const otherToken = await loginAs('other-author', password);
    await request(app.getHttpServer())
      .get(endpoint)
      .query({ userId: authorId })
      .auth(otherToken, { type: 'bearer' })
      .expect(200, { connected: false, cloudName: null });

    await request(app.getHttpServer())
      .put(endpoint)
      .query({ userId: authorId })
      .auth(otherToken, { type: 'bearer' })
      .send({
        cloudName: 'other-fixture-cloud',
        apiKey: 'other-fixture-api-key',
        apiSecret: 'other-fixture-api-secret',
      })
      .expect(200, { connected: true, cloudName: 'other-fixture-cloud' });

    await request(app.getHttpServer())
      .get(endpoint)
      .query({ userId: authorId })
      .auth(otherToken, { type: 'bearer' })
      .expect(200, { connected: true, cloudName: 'other-fixture-cloud' });

    await request(app.getHttpServer())
      .get(endpoint)
      .query({ userId: otherAuthorId })
      .auth(nextToken, { type: 'bearer' })
      .expect(200, { connected: true, cloudName: 'fixture-cloud' });
    expect(ping).toHaveBeenCalledTimes(2);
  });

  it('rejects USER on both routes before contacting Cloudinary or writing a connection', async () => {
    const userId = randomUUID();
    const password = 'fixture-reader-password';
    const passwordHash = await argon2.hash(password);
    await sql`
      INSERT INTO users (id, username, password_hash, role)
      VALUES (${userId}, 'fixture-reader', ${passwordHash}, 'USER')
    `;
    const token = await loginAs('fixture-reader', password);
    const ping = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected Cloudinary request'));

    await request(app.getHttpServer())
      .get(endpoint)
      .auth(token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .put(endpoint)
      .auth(token, { type: 'bearer' })
      .send({
        cloudName: 'fixture-cloud',
        apiKey: 'fixture-api-key',
        apiSecret: 'fixture-api-secret',
      })
      .expect(403);

    expect(ping).not.toHaveBeenCalled();
    const connections = await sql`
      SELECT user_id FROM author_cloudinary_connections WHERE user_id = ${userId}
    `;
    expect(connections).toHaveLength(0);
  });

  it('binds each media session to the cloud active on its first open', async () => {
    const authorId = randomUUID();
    const originalSession = randomUUID();
    const nextSession = randomUUID();
    await sql`
      INSERT INTO users (id, username, password_hash, role)
      VALUES (${authorId}, 'media-author', 'unused', 'AUTHOR')
    `;
    const token = await jwt.signAsync({ sub: authorId });
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(Response.json({ status: 'ok' })),
      );
    const open = (id: string) =>
      request(app.getHttpServer())
        .put(`/api/media/sessions/${id}`)
        .auth(token, { type: 'bearer' });
    const save = (cloudName: string, apiKey: string) =>
      request(app.getHttpServer())
        .put(endpoint)
        .auth(token, { type: 'bearer' })
        .send({ cloudName, apiKey, apiSecret: 'fixture-api-secret' })
        .expect(200, { connected: true, cloudName });

    await open(originalSession).expect(403);
    await save('fixture-cloud-a', 'old-key');
    await open(originalSession).expect(200);
    await save('fixture-cloud-a', 'replacement-key');
    await save('fixture-cloud-b', 'new-cloud-key');
    await open(originalSession).expect(200);
    await open(nextSession).expect(200);

    const sessions = await sql`
      SELECT s.id, s.author_cloud_name, c.is_active, c.api_key
      FROM media_sessions s
      JOIN author_cloudinary_connections c
        ON (s.user_id, s.author_cloud_name) = (c.user_id, c.cloud_name)
      WHERE s.user_id = ${authorId}::uuid
      ORDER BY s.author_cloud_name
    `;
    expect([...sessions]).toEqual([
      {
        id: originalSession,
        author_cloud_name: 'fixture-cloud-a',
        is_active: false,
        api_key: 'replacement-key',
      },
      {
        id: nextSession,
        author_cloud_name: 'fixture-cloud-b',
        is_active: true,
        api_key: 'new-cloud-key',
      },
    ]);
  });

  it('publishes and retries deletion in the original cloud after the active cloud changes', async () => {
    const authorId = randomUUID();
    const adminId = randomUUID();
    const sessionId = randomUUID();
    const uploadId = randomUUID();
    const nextSession = randomUUID();
    await sql`
      INSERT INTO users (id, username, password_hash, role) VALUES
        (${authorId}, 'cloud-switch-author', 'unused', 'AUTHOR'),
        (${adminId}, 'cloud-switch-admin', 'unused', 'ADMIN')
    `;
    const token = await jwt.signAsync({ sub: authorId });
    const adminToken = await jwt.signAsync({ sub: adminId });
    const secret = 'fixture-a-secret';
    const pngBytes = 1200;
    const photoLimit = 5000;
    const api = request(app.getHttpServer());
    const provider = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((url) => {
        const pathname = new URL(url instanceof Request ? url.url : url)
          .pathname;
        if (pathname.endsWith('/ping'))
          return Promise.resolve(Response.json({ status: 'ok' }));
        if (pathname.endsWith('/usage')) {
          return Promise.resolve(
            Response.json({
              media_limits: { image_max_size_bytes: photoLimit },
            }),
          );
        }
        return Promise.reject(new Error('Unexpected Cloudinary request'));
      });
    const save = (cloudName: string, apiKey: string, apiSecret: string) =>
      api
        .put(endpoint)
        .auth(token, { type: 'bearer' })
        .send({ cloudName, apiKey, apiSecret })
        .expect(200);
    const open = (id: string, country?: string) =>
      api
        .put(`/api/media/sessions/${id}`)
        .auth(token, { type: 'bearer' })
        .send(country ? { country } : {});
    const reserve = (id: string, fileId: string, bytes: number) =>
      api
        .put(`/api/media/sessions/${id}/uploads/${fileId}`)
        .auth(token, { type: 'bearer' })
        .send({ mediaType: 'PHOTO', bytes });
    const folderMode = jest.spyOn(cloudinary.api, 'config').mockResolvedValue({
      settings: { folder_mode: 'dynamic' },
    });
    const assetFolder = 'travel/cloud-switch-author';

    await save('fixture-run-a', 'key-a', secret);
    await open(sessionId).expect(200);
    await save('fixture-run-b', 'key-b', 'fixture-b-secret');
    await reserve(sessionId, randomUUID(), photoLimit + 1).expect(400);
    const { body: signed } = (await reserve(
      sessionId,
      uploadId,
      pngBytes,
    ).expect(200)) as {
      body: {
        cloudName: string;
        apiKey: string;
        signature: string;
        timestamp: number;
        params: { public_id: string; asset_folder: string };
      };
    };
    const publicId = signed.params.public_id;
    const signature = createHash('sha1')
      .update(
        `asset_folder=${assetFolder}&overwrite=false&public_id=${publicId}&timestamp=${signed.timestamp}${secret}`,
      )
      .digest('hex');
    expect(signed).toMatchObject({
      cloudName: 'fixture-run-a',
      apiKey: 'key-a',
      signature,
      params: { asset_folder: assetFolder },
    });
    await reserve(sessionId, uploadId, pngBytes)
      .expect(200)
      .expect(({ body }: { body: unknown }) => {
        expect(body).toMatchObject({ params: signed.params });
      });
    expect(folderMode).toHaveBeenCalledTimes(1);
    expect(folderMode).toHaveBeenCalledWith({
      cloud_name: 'fixture-run-a',
      api_key: 'key-a',
      api_secret: secret,
      settings: true,
      timeout: 5_000,
    });
    expect(JSON.stringify(signed)).not.toContain(secret);
    expect(provider).toHaveBeenCalledWith(
      'https://api.cloudinary.com/v1_1/fixture-run-a/usage',
      expect.objectContaining({
        headers: {
          Authorization: `Basic ${Buffer.from(`key-a:${secret}`).toString('base64')}`,
        },
      }),
    );

    const mediaUrl = `https://res.cloudinary.com/fixture-run-a/image/upload/${publicId}.png`;
    const resource = {
      public_id: publicId,
      resource_type: 'image',
      secure_url: mediaUrl,
      format: 'png',
      bytes: pngBytes,
      width: 80,
      height: 60,
    };
    const metadata = jest
      .spyOn(cloudinary.api, 'resource')
      .mockResolvedValueOnce({ ...resource, bytes: photoLimit + 1 })
      .mockResolvedValue(resource);
    const complete = () =>
      api
        .post(`/api/media/sessions/${sessionId}/uploads/${uploadId}/complete`)
        .auth(token, { type: 'bearer' });
    await complete().expect(400);
    await complete().expect(201, { ready: true });
    expect(metadata).toHaveBeenLastCalledWith(publicId, {
      cloud_name: 'fixture-run-a',
      api_key: 'key-a',
      api_secret: secret,
      resource_type: 'image',
    });
    const {
      body: { postId },
    } = (await api
      .post(`/api/media/sessions/${sessionId}/publish`)
      .auth(token, { type: 'bearer' })
      .send({ uploadIds: [uploadId] })
      .expect(201)) as { body: { postId: string } };
    await api
      .get(`/api/posts/${postId}`)
      .expect(200)
      .expect(({ body }: { body: unknown }) => {
        expect(body).toMatchObject({
          post: {
            media_url: mediaUrl,
            folder: assetFolder,
            media_width: 80,
            media_height: 60,
          },
        });
      });

    await open(nextSession, 'Thailand').expect(200);
    await open(nextSession, 'Japan').expect(409);
    const countryUploadId = randomUUID();
    const { body: nextUpload } = (await reserve(
      nextSession,
      countryUploadId,
      pngBytes,
    ).expect(200)) as { body: { params: { public_id: string } } };
    expect(nextUpload).toMatchObject({
      cloudName: 'fixture-run-b',
      apiKey: 'key-b',
      params: { asset_folder: `${assetFolder}/TH` },
    });
    await api
      .post(`/api/media/sessions/${nextSession}/publish`)
      .auth(token, { type: 'bearer' })
      .send({ uploadIds: [countryUploadId], country: 'Japan' })
      .expect(400)
      .expect(({ body }: { body: unknown }) => {
        expect(body).toMatchObject({
          message: 'Страна публикации должна совпадать со страной формы',
        });
      });

    const destroy = jest
      .spyOn(cloudinary.uploader, 'destroy')
      .mockRejectedValueOnce({ http_code: 401, message: secret })
      .mockResolvedValue({ result: 'ok' });
    await api
      .delete(`/api/posts/${postId}`)
      .auth(token, { type: 'bearer' })
      .expect(200, { ok: true, pendingMediaDeletions: 1 });
    expect(destroy).toHaveBeenCalledWith(
      publicId,
      expect.objectContaining({
        cloud_name: 'fixture-run-a',
        api_key: 'key-a',
      }),
    );
    const [job] =
      await sql`SELECT cloud_name, author_user_id, attempts, last_error FROM media_deletions WHERE public_id = ${publicId}`;
    expect(job).toMatchObject({
      cloud_name: 'fixture-run-a',
      author_user_id: authorId,
      attempts: 1,
    });
    expect(JSON.stringify(job)).not.toContain(secret);

    await save('fixture-run-a', 'replacement-a-key', 'replacement-a-secret');
    await save('fixture-run-b', 'key-b', 'fixture-b-secret');
    await sql`UPDATE media_deletions SET retain_until = now() WHERE public_id = ${publicId}`;
    await api
      .post('/api/media/cleanup/retry')
      .auth(adminToken, { type: 'bearer' })
      .expect(201, { jobs: [] });
    expect(destroy).toHaveBeenLastCalledWith(
      publicId,
      expect.objectContaining({
        cloud_name: 'fixture-run-a',
        api_key: 'replacement-a-key',
        api_secret: 'replacement-a-secret',
      }),
    );
    await api.get(`/api/posts/${postId}`).expect(404);

    const cancelledId = nextUpload.params.public_id;
    await api
      .delete(`/api/media/sessions/${nextSession}`)
      .auth(token, { type: 'bearer' })
      .expect(200, { postId: null });
    const [cancelled] = await sql`
      SELECT cloud_name, author_user_id, next_attempt_at > now() AS delayed
      FROM media_deletions WHERE public_id = ${cancelledId}
    `;
    expect(cancelled).toEqual({
      cloud_name: 'fixture-run-b',
      author_user_id: authorId,
      delayed: true,
    });
    await sql`UPDATE media_deletions SET next_attempt_at = now(), retain_until = now() WHERE public_id = ${cancelledId}`;
    await api
      .post('/api/media/cleanup/retry')
      .auth(adminToken, { type: 'bearer' })
      .expect(201, { jobs: [] });
    expect(destroy).toHaveBeenLastCalledWith(
      cancelledId,
      expect.objectContaining({
        cloud_name: 'fixture-run-b',
        api_key: 'key-b',
      }),
    );
  });
});
