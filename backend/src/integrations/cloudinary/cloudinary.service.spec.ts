/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';

jest.mock('cloudinary', () => ({
  v2: { config: jest.fn(), api: { resource: jest.fn() } },
}));

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
