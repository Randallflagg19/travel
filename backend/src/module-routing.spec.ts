import { ConfigModule } from '@nestjs/config';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import type { JwtUser } from './auth/jwt-user.type';
import { DbModule } from './db/db.module';
import { DbService } from './db/db.service';
import { ImportsModule } from './imports/imports.module';
import { CloudinaryImportService } from './imports/cloudinary-import.service';
import { MediaDimensionsBackfillService } from './imports/media-dimensions-backfill.service';
import { CloudinaryService } from './integrations/cloudinary/cloudinary.service';
import { CloudinaryCatalogService } from './integrations/cloudinary/cloudinary-catalog.service';
import { MEDIA_LIMITS } from './media/media-contract';
import { MediaSessionsService } from './media/media-sessions.service';
import { MediaCleanupService } from './media/media-cleanup.service';
import { PostsModule } from './posts/posts.module';
import { PublishMediaPostService } from './posts/publish-media-post.service';
import { DeletePostService } from './posts/delete-post.service';

describe('Backend modules and existing HTTP routes', () => {
  let app: INestApplication<Server>;
  let modules: TestingModule;
  let actor: JwtUser;
  const id = '00000000-0000-4000-8000-000000000010';

  beforeAll(async () => {
    modules = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ DB_MIGRATE_ON_START: 'false' })],
        }),
        DbModule,
        PostsModule,
        ImportsModule,
      ],
    })
      .overrideProvider(DbService)
      .useValue({ client: null })
      .overrideProvider(CloudinaryService)
      .useValue({
        getClientConfig: () => ({ cloudName: 'demo', apiKey: 'key' }),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest<{ user: JwtUser }>().user = actor;
          return true;
        },
      })
      .compile();
    app = modules.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(() => {
    actor = { sub: id, username: 'fixture', role: 'ADMIN' };
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
  });

  it('routes Cloudinary administration to its integration and import services', async () => {
    const importer = jest
      .spyOn(modules.get(CloudinaryImportService), 'importPrefix')
      .mockResolvedValue({
        prefix: 'fixture/',
        scanned: 1,
        inserted: 1,
        errors: [],
      });
    const probe = jest
      .spyOn(modules.get(CloudinaryCatalogService), 'probePrefix')
      .mockResolvedValue({
        prefix: 'tapir',
        ping: {},
        root_folders: {},
        sub_folders: null,
      });
    const dimensions = jest
      .spyOn(
        modules.get(MediaDimensionsBackfillService),
        'backfillMediaDimensions',
      )
      .mockResolvedValue({
        scanned: 0,
        updated: 0,
        unavailable: 0,
        hasMore: false,
      });
    const reset = jest
      .spyOn(
        modules.get(MediaDimensionsBackfillService),
        'resetMediaDimensionsBackfill',
      )
      .mockResolvedValue({ reset: 0 });
    await request(app.getHttpServer())
      .get('/api/admin/cloudinary/config')
      .expect(200)
      .expect({ cloudName: 'demo', apiKey: 'key' });
    await request(app.getHttpServer())
      .post('/api/admin/cloudinary/probe')
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/admin/cloudinary/import')
      .send({ max: 5 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/admin/cloudinary/backfill-media-dimensions')
      .send({ max: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/admin/cloudinary/reset-media-dimensions-backfill')
      .send({})
      .expect(201);
    expect(importer).toHaveBeenCalledWith({
      prefix: 'fixture/',
      userId: id,
      max: 5,
    });
    expect(probe).toHaveBeenCalledWith({ prefix: 'tapir/' });
    expect(dimensions).toHaveBeenCalledWith({ max: 10 });
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it.each(['AUTHOR', 'ADMIN', 'SUPERADMIN'] as const)(
    '%s can manage an upload session and publish media',
    async (role) => {
      const userId = '00000000-0000-4000-8000-000000000011';
      const uploadId = '00000000-0000-4000-8000-000000000012';
      actor = { sub: userId, role };

      const sessions = modules.get(MediaSessionsService);
      const open = jest
        .spyOn(sessions, 'open')
        .mockResolvedValue({ id, limits: MEDIA_LIMITS });
      const reserve = jest.spyOn(sessions, 'reserve').mockResolvedValue({
        cloudName: 'demo',
        apiKey: 'key',
        signature: 'signature',
        timestamp: 1,
        params: { public_id: `fixture/${uploadId}`, overwrite: false },
        resourceType: 'image',
        ready: false,
      });
      const complete = jest
        .spyOn(sessions, 'complete')
        .mockResolvedValue({ ready: true });
      const cancel = jest
        .spyOn(sessions, 'cancel')
        .mockResolvedValue({ postId: id });
      const publish = jest
        .spyOn(modules.get(PublishMediaPostService), 'publish')
        .mockResolvedValue({ postId: id });

      const sessionPath = `/api/media/sessions/${id}`;
      const uploadPath = `${sessionPath}/uploads/${uploadId}`;
      const photo = { mediaType: 'PHOTO', bytes: 1024 };
      const publication = { uploadIds: [uploadId] };
      const api = request(app.getHttpServer());
      await api.put(sessionPath).expect(200);
      await api.put(uploadPath).send(photo).expect(200);
      await api.post(`${uploadPath}/complete`).expect(201);
      await api
        .post(`${sessionPath}/publish`)
        .send(publication)
        .expect(201)
        .expect({ postId: id });
      await api.delete(sessionPath).expect(200).expect({ postId: id });

      expect(open).toHaveBeenCalledWith(id, userId);
      expect(reserve).toHaveBeenCalledWith(id, uploadId, userId, photo);
      expect(complete).toHaveBeenCalledWith(id, uploadId, userId);
      expect(publish).toHaveBeenCalledWith(id, userId, publication);
      expect(cancel).toHaveBeenCalledWith(id, userId);
    },
  );

  it('keeps cleanup and post deletion available at their existing routes', async () => {
    const cleanup = modules.get(MediaCleanupService);
    const status = jest
      .spyOn(cleanup, 'cleanupStatus')
      .mockResolvedValue({ jobs: [] });
    const retry = jest
      .spyOn(cleanup, 'retryFailedCleanup')
      .mockResolvedValue({ jobs: [] });
    const deletion = jest
      .spyOn(modules.get(DeletePostService), 'deletePost')
      .mockResolvedValue({ pendingMediaDeletions: 2 });
    await request(app.getHttpServer())
      .get('/api/media/cleanup')
      .expect(200)
      .expect({ jobs: [] });
    await request(app.getHttpServer())
      .post('/api/media/cleanup/retry')
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/posts/${id}`)
      .expect(200)
      .expect({ ok: true, pendingMediaDeletions: 2 });
    expect(status).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(deletion).toHaveBeenCalledWith(id, actor);
  });

  it('keeps media cleanup and import restricted for AUTHOR', async () => {
    actor = { sub: id, role: 'AUTHOR' };
    const cleanup = modules.get(MediaCleanupService);
    const status = jest.spyOn(cleanup, 'cleanupStatus');
    const retry = jest.spyOn(cleanup, 'retryFailedCleanup');
    const importer = jest.spyOn(
      modules.get(CloudinaryImportService),
      'importPrefix',
    );
    const api = request(app.getHttpServer());
    await api.get('/api/media/cleanup').expect(403);
    await api.post('/api/media/cleanup/retry').expect(403);
    await api.post('/api/admin/cloudinary/import').send({}).expect(403);
    expect(status).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(importer).not.toHaveBeenCalled();
  });

  it('prevents USER from opening upload sessions or publishing media', async () => {
    actor = { sub: id, role: 'USER' };
    const open = jest.spyOn(modules.get(MediaSessionsService), 'open');
    const publish = jest.spyOn(modules.get(PublishMediaPostService), 'publish');
    const api = request(app.getHttpServer());
    await api.put(`/api/media/sessions/${id}`).expect(403);
    await api
      .post(`/api/media/sessions/${id}/publish`)
      .send({ uploadIds: [id] })
      .expect(403);
    expect(open).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
