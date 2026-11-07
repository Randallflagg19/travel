import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';
import type { CloudinaryResource, ResourceType } from './cloudinary.types';

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/g, '');
}

@Injectable()
export class CloudinaryCatalogService {
  constructor(private readonly cloud: CloudinaryService) {}

  async listByAssetFolder(params: {
    assetFolder: string;
    resourceType: ResourceType;
    maxResults: number;
    nextCursor?: string;
  }): Promise<{ resources: CloudinaryResource[]; next_cursor?: string }> {
    // Cloudinary DAM uses "asset folders" (Media Library folders).
    const resUnknown: unknown = await (
      cloudinary.api as unknown as {
        resources_by_asset_folder: (
          assetFolder: string,
          options: Record<string, unknown>,
        ) => Promise<unknown>;
      }
    ).resources_by_asset_folder(params.assetFolder, {
      type: 'upload',
      resource_type: params.resourceType,
      max_results: params.maxResults,
      next_cursor: params.nextCursor,
    });

    return resUnknown as {
      resources: CloudinaryResource[];
      next_cursor?: string;
    };
  }

  async listSubFoldersBfs(params: {
    root: string;
    maxFolders?: number;
  }): Promise<string[]> {
    // Returns folder paths including the root itself.
    const root = stripTrailingSlashes(params.root);
    const maxFolders = Math.max(1, Math.min(2000, params.maxFolders ?? 500));

    const seen = new Set<string>();
    const out: string[] = [];
    const queue: string[] = [root];

    while (queue.length > 0 && out.length < maxFolders) {
      const cur = queue.shift();
      if (!cur) break;
      if (seen.has(cur)) continue;
      seen.add(cur);
      out.push(cur);

      let resUnknown: unknown;
      try {
        resUnknown = (await cloudinary.api.sub_folders(cur)) as unknown;
      } catch {
        // If sub_folders isn't available for this path, just stop descending.
        continue;
      }

      const res = resUnknown as { folders?: Array<{ path?: string }> };
      for (const f of res.folders ?? []) {
        const p = typeof f.path === 'string' ? f.path : null;
        if (!p) continue;
        const normalized = stripTrailingSlashes(p);
        if (!seen.has(normalized)) queue.push(normalized);
        if (out.length + queue.length >= maxFolders) break;
      }
    }

    return out;
  }

  async resourcesByIds(
    publicIds: string[],
    resourceType: 'image' | 'video',
  ): Promise<CloudinaryResource[]> {
    this.cloud.getClientConfig();
    try {
      const raw: unknown = await cloudinary.api.resources_by_ids(publicIds, {
        resource_type: resourceType,
        type: 'upload',
      });
      return (raw as { resources?: CloudinaryResource[] }).resources ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      throw new ServiceUnavailableException(
        `Cloudinary batch lookup failed; no remaining rows were marked (${message})`,
      );
    }
  }

  async probePrefix(params: { prefix: string }) {
    this.cloud.getClientConfig();
    const prefix = params.prefix.trim();
    const folder = prefix ? stripTrailingSlashes(prefix) : null;

    let ping: unknown = null;
    try {
      ping = (await cloudinary.api.ping()) as unknown;
    } catch (e) {
      ping = { error: (e as Error).message };
    }

    let rootFolders: unknown = null;
    try {
      rootFolders = (await cloudinary.api.root_folders()) as unknown;
    } catch (e) {
      rootFolders = { error: (e as Error).message };
    }

    let subFolders: unknown = null;
    if (folder) {
      try {
        subFolders = (await cloudinary.api.sub_folders(folder)) as unknown;
      } catch (e) {
        subFolders = { error: (e as Error).message };
      }
    }

    return {
      prefix: folder,
      ping,
      root_folders: rootFolders,
      sub_folders: folder ? { folder, result: subFolders } : null,
    };
  }
}
