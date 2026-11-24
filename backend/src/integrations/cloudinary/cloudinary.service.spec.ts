/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { createHash } from 'node:crypto';
import { CloudinaryService } from './cloudinary.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    api: { resource: jest.fn() },
    uploader: { destroy: jest.fn() },
  },
}));

beforeEach(() => jest.clearAllMocks());

it('retrieves video duration when the ordinary Admin API response omits it', async () => {
  const ordinaryResponse = {
    public_id: 'travel/test/video',
    resource_type: 'video',
    secure_url: 'https://res.cloudinary.com/demo/video/upload/test.webm',
    format: 'webm',
    bytes: 37681,
    width: 320,
    height: 180,
  };
  // The real Admin API includes duration only with extended media metadata.
  jest
    .mocked(cloudinary.api.resource)
    .mockImplementation((...args: unknown[]) => {
      const options = args[1] as { media_metadata?: boolean } | undefined;
      return Promise.resolve({
        ...ordinaryResponse,
        ...(options?.media_metadata ? { duration: 2.904147 } : {}),
      });
    });
  const config = new ConfigService({
    CLOUDINARY_CLOUD_NAME: 'demo',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
  });
  const service = new CloudinaryService(config);

  await expect(
    service.getUploadResource('travel/test/video', 'video'),
  ).resolves.toMatchObject({
    public_id: 'travel/test/video',
    resource_type: 'video',
    duration: 2.904147,
  });
});

it('uses author credentials for media operations without changing the application cloud', async () => {
  const service = new CloudinaryService(
    new ConfigService({
      CLOUDINARY_CLOUD_NAME: 'app-cloud',
      CLOUDINARY_API_KEY: 'app-key',
      CLOUDINARY_API_SECRET: 'app-secret',
    }),
  );
  const author = {
    cloudName: 'author-cloud',
    apiKey: 'author-key',
    apiSecret: 'author-secret',
  };
  const publicId = 'travel/test/photo';
  jest
    .mocked(cloudinary.api.resource)
    .mockResolvedValue({ public_id: publicId });
  jest.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' });

  expect(service.getClientConfig(author)).toEqual({
    cloudName: author.cloudName,
    apiKey: author.apiKey,
  });
  const signature = service.signUpload(
    { public_id: publicId, timestamp: 1 },
    author,
  );
  expect(signature.signature).toBe(
    createHash('sha1')
      .update(`public_id=${publicId}&timestamp=1${author.apiSecret}`)
      .digest('hex'),
  );

  await Promise.all([
    service.getUploadResource(publicId, 'image', author),
    service.getUploadResource(publicId, 'image'),
    service.destroy(publicId, 'image', author),
  ]);
  const authorOptions = {
    cloud_name: author.cloudName,
    api_key: author.apiKey,
    api_secret: author.apiSecret,
    resource_type: 'image',
  };
  expect(cloudinary.api.resource).toHaveBeenCalledWith(publicId, authorOptions);
  expect(cloudinary.api.resource).toHaveBeenCalledWith(publicId, {
    cloud_name: 'app-cloud',
    api_key: 'app-key',
    api_secret: 'app-secret',
    resource_type: 'image',
  });
  expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(publicId, {
    ...authorOptions,
    invalidate: true,
  });
  expect(cloudinary.config).toHaveBeenCalledTimes(1);
});
