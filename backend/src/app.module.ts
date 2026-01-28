import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { PostsModule } from './posts/posts.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        CORS_ORIGIN: Joi.string().allow('').default(''),
        DATABASE_URL: Joi.string().allow('').optional(),
        DB_MIGRATE_ON_START: Joi.string()
          .valid('true', 'false')
          .default('false'),
        JWT_SECRET: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().min(16).required(),
          otherwise: Joi.string().min(16).default('dev-dev-dev-dev-dev-dev'),
        }),
        CLOUDINARY_CLOUD_NAME: Joi.string().allow('').optional(),
        CLOUDINARY_API_KEY: Joi.string().allow('').optional(),
        CLOUDINARY_API_SECRET: Joi.string().allow('').optional(),
      }),
    }),
    DbModule,
    AuthModule,
    PostsModule,
    CloudinaryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
