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

  it('routes sessions and publication to different modules without changing their URLs', async () => {
    const sessions = modules.get(MediaSessionsService);
    const open = jest.spyOn(sessions, 'open').mockResolvedValue({
      id,
      limits: {
        count: 10,
        photoBytes: 20971520,
        videoBytes: 94371840,
        videoSeconds: 600,
      },
    });
    const cancel = jest
      .spyOn(sessions, 'cancel')
      .mockResolvedValue({ postId: null });
    const publish = jest
      .spyOn(modules.get(PublishMediaPostService), 'publish')
      .mockResolvedValue({ postId: id });
    await request(app.getHttpServer())
      .put(`/api/media/sessions/${id}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/media/sessions/${id}/publish`)
      .send({ uploadIds: [id] })
      .expect(201)
      .expect({ postId: id });
    await request(app.getHttpServer())
      .delete(`/api/media/sessions/${id}`)
      .expect(200)
      .expect({ postId: null });
    expect(open).toHaveBeenCalledWith(id, id);
    expect(publish).toHaveBeenCalledWith(id, id, { uploadIds: [id] });
    expect(cancel).toHaveBeenCalledWith(id, id);
  });

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

  it('still prevents AUTHOR from publishing media or running imports', async () => {
    actor = { sub: id, role: 'AUTHOR' };
    const publish = jest.spyOn(modules.get(PublishMediaPostService), 'publish');
    const importer = jest.spyOn(
      modules.get(CloudinaryImportService),
      'importPrefix',
    );
    await request(app.getHttpServer())
      .post(`/api/media/sessions/${id}/publish`)
      .send({ uploadIds: [id] })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/admin/cloudinary/import')
      .send({})
      .expect(403);
    expect(publish).not.toHaveBeenCalled();
    expect(importer).not.toHaveBeenCalled();
  });
});
