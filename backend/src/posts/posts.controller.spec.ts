/// <reference types="jest" />

import { ForbiddenException } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

describe('PostsController author creation', () => {
  it('passes the authenticated author role to the service, which rejects forged media', async () => {
    const create = jest.fn().mockRejectedValue(new ForbiddenException());
    const posts = {
      create,
    } as unknown as PostsService;
    const controller = new PostsController(posts);
    const author = {
      sub: '00000000-0000-4000-8000-000000000010',
      role: 'AUTHOR' as const,
    };
    await expect(
      controller.create(author, {
        mediaType: 'PHOTO',
        mediaUrl: 'https://example.com/forged.jpg',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: author.sub, actorRole: 'AUTHOR' }),
    );
  });
});
