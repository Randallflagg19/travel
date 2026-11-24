/// <reference types="jest" />

import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import postgres, { type Sql } from 'postgres';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { DbModule } from '../src/db/db.module';
import { DbService } from '../src/db/db.service';
import { runVersionedMigrations } from '../src/db/versioned-migrations';

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
});
