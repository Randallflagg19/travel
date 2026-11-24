import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, randomBytes } from 'node:crypto';
import * as Joi from 'joi';
import { DbService } from '../db/db.service';

type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

const credentialsSchema = Joi.object<CloudinaryCredentials>({
  cloudName: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z][a-z0-9-]{1,127}$/)
    .required(),
  apiKey: Joi.string()
    .trim()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .max(256)
    .required(),
  apiSecret: Joi.string().trim().max(512).required(),
}).required();

async function verifyCredentials({
  cloudName,
  apiKey,
  apiSecret,
}: CloudinaryCredentials) {
  const authorization = Buffer.from(`${apiKey}:${apiSecret}`).toString(
    'base64',
  );
  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/ping`,
      {
        method: 'GET',
        headers: { Authorization: `Basic ${authorization}` },
        redirect: 'error',
        signal: AbortSignal.timeout(5_000),
      },
    );
  } catch {
    throw new ServiceUnavailableException('Could not reach Cloudinary');
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if ([400, 401, 403, 404].includes(response.status)) {
      throw new BadRequestException(
        'Cloudinary rejected the cloud name or API credentials',
      );
    }
    throw new ServiceUnavailableException(
      'Could not verify the Cloudinary connection',
    );
  }

  const result: unknown = await response.json().catch(() => null);
  if ((result as { status?: unknown } | null)?.status !== 'ok') {
    throw new ServiceUnavailableException(
      'Cloudinary did not confirm the connection',
    );
  }
}

function encryptSecret(apiSecret: string, key: Buffer, userId: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(userId));
  const ciphertext = Buffer.concat([
    cipher.update(apiSecret, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    nonce.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

@Injectable()
export class AuthorCloudinaryService {
  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
  ) {}

  async save(userId: string, body: unknown) {
    const validation = credentialsSchema.validate(body);
    if (validation.error) {
      throw new BadRequestException(
        'Enter a valid Cloudinary cloud name, API key and API secret',
      );
    }

    const sql = this.db.client;
    const key = this.config.get<string>('AUTHOR_CLOUDINARY_ENCRYPTION_KEY');
    if (!sql || !key || !/^[a-f0-9]{64}$/i.test(key)) {
      throw new ServiceUnavailableException(
        'Author Cloudinary connections are not configured',
      );
    }

    await verifyCredentials(validation.value);
    const { cloudName, apiKey, apiSecret } = validation.value;
    const encryptedSecret = encryptSecret(
      apiSecret,
      Buffer.from(key, 'hex'),
      userId,
    );
    await sql`
      INSERT INTO author_cloudinary_connections (user_id, cloud_name, api_key, api_secret_encrypted)
      VALUES (${userId}::uuid, ${cloudName}, ${apiKey}, ${encryptedSecret})
      ON CONFLICT (user_id) DO UPDATE
      SET cloud_name = EXCLUDED.cloud_name,
          api_key = EXCLUDED.api_key,
          api_secret_encrypted = EXCLUDED.api_secret_encrypted
    `;

    return { connected: true, cloudName };
  }

  async getStatus(userId: string) {
    const sql = this.db.client;
    if (!sql) {
      throw new ServiceUnavailableException('Database is not configured');
    }

    const [connection] = await sql<{ cloud_name: string }[]>`
      SELECT cloud_name
      FROM author_cloudinary_connections
      WHERE user_id = ${userId}::uuid
    `;
    return {
      connected: Boolean(connection),
      cloudName: connection?.cloud_name ?? null,
    };
  }
}
