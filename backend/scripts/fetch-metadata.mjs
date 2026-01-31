const assetFolder = process.argv[2]?.trim() || 'tapir/Thailand/Bangkok';
const publicIdArg = process.argv[3]?.trim();
const resourceTypeArg = process.argv[4]?.trim() || 'image';

const { v2: cloudinary } = await import('cloudinary');

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('Missing CLOUDINARY_* env. Use --env-file=.env');
  process.exit(1);
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

let publicId;
let resourceType = resourceTypeArg;

if (publicIdArg) {
  // В API resource() public_id без пути папки (как в ответе resources_by_asset_folder)
  publicId = publicIdArg.includes('/') ? publicIdArg : publicIdArg;
  console.log('Fetching metadata for:', publicId);
} else {
  // Список по папке, берём первый ресурс
  const list = await cloudinary.api.resources_by_asset_folder(assetFolder, {
    type: 'upload',
    resource_type: 'image',
    max_results: 1,
  });
  const resources = list.resources || [];
  if (resources.length === 0) {
    console.log('No resources in folder. List response:');
    console.log(JSON.stringify(list, null, 2));
    process.exit(0);
  }
  const first = resources[0];
  publicId = first.public_id;
  resourceType = first.resource_type || 'image';
  console.log('First resource public_id:', publicId);
}

const details = await cloudinary.api.resource(publicId, {
  resource_type: resourceType,
  media_metadata: true,
});

console.log(JSON.stringify(details, null, 2));
