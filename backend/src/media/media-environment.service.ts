import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MediaEnvironmentService {
  constructor(private readonly config: ConfigService) {}

  current(): string {
    const value =
      this.config.get<string>('MEDIA_ENVIRONMENT') ||
      (this.config.get<string>('NODE_ENV') === 'production'
        ? ''
        : 'development');
    if (!['production', 'staging', 'development', 'test'].includes(value)) {
      throw new BadRequestException(
        'Set MEDIA_ENVIRONMENT to production, staging, development or test',
      );
    }
    return value;
  }
}
