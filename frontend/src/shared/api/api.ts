export type ApiPost = {
  id: string;
  user_id: string;
  media_type: "PHOTO" | "VIDEO" | "AUDIO";
  media_url: string;
  cloudinary_public_id: string | null;
  folder: string | null;
  text: string | null;
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me?: boolean;
};

export type PostsPage = {
  items: ApiPost[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type PlacesResponse = {
  countries: Array<{
    country: string;
    count: number;
    cities: Array<{ city: string; count: number }>;
  }>;
  unknown: { count: number };
};

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  name: string | null;
  created_at: string;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL is not set. Create .env.local from .env.local.example.");
  }
  return url.replace(/\/+$/, "");
}

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.clone().json()) as unknown;
    if (data && typeof data === "object") {
      const maybe = data as { message?: unknown; error?: unknown };
      const msg =
        typeof maybe.message === "string"
          ? maybe.message
          : Array.isArray(maybe.message)
            ? maybe.message.filter((x) => typeof x === "string").join(", ")
            : null;
      if (msg) return msg;
      if (typeof maybe.error === "string") return maybe.error;
    }
  } catch {
    // ignore
  }
  return await res.text().catch(() => "");
}

export async function fetchPostsPage(
  params: {
    limit: number;
    cursor?: string;
    order?: "asc" | "desc";
    country?: string;
    city?: string;
    unknown?: boolean;
  },
  accessToken?: string | null,
): Promise<PostsPage> {
  const api = getApiBaseUrl();
  const search = new URLSearchParams();
  search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.order) search.set("order", params.order);
  if (params.country) search.set("country", params.country);
  if (params.city) search.set("city", params.city);
  if (params.unknown) search.set("unknown", "true");

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${api}/posts?${search.toString()}`, {
    cache: "no-store",
    headers,
  });
  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Failed to load posts (${res.status}): ${text}`);
  }
  return (await res.json()) as PostsPage;
}

export async function likePost(
  accessToken: string,
  postId: string,
): Promise<{ ok: boolean }> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/posts/${postId}/like`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Like failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { ok: boolean };
}

export async function unlikePost(
  accessToken: string,
  postId: string,
): Promise<{ ok: boolean }> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/posts/${postId}/like`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Unlike failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { ok: boolean };
}

export async function fetchPlaces(): Promise<PlacesResponse> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/places`, { cache: "no-store" });
  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Failed to load places (${res.status}): ${text}`);
  }
  return (await res.json()) as PlacesResponse;
}

export async function authRegister(params: {
  username: string;
  password: string;
  email?: string;
  name?: string;
}): Promise<AuthResponse> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: params.username,
      email: params.email,
      password: params.password,
      name: params.name,
    }),
  });

  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Register failed (${res.status}): ${text}`);
  }

  return (await res.json()) as AuthResponse;
}

export async function authLogin(params: {
  login: string;
  password: string;
}): Promise<AuthResponse> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      login: params.login,
      password: params.password,
    }),
  });

  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Login failed (${res.status}): ${text}`);
  }

  return (await res.json()) as AuthResponse;
}

export async function authMe(accessToken: string): Promise<{ user: AuthUser }> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Me failed (${res.status}): ${text}`);
  }

  return (await res.json()) as { user: AuthUser };
}

export async function adminCloudinaryConfig(accessToken: string): Promise<{
  cloudName: string;
  apiKey: string;
}> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/admin/cloudinary/config`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Cloudinary config failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { cloudName: string; apiKey: string };
}

export async function adminCloudinarySignUpload(
  accessToken: string,
  paramsToSign: Record<string, unknown>,
): Promise<{ signature: string; timestamp: number }> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/admin/cloudinary/sign-upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ paramsToSign }),
  });
  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Cloudinary sign failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { signature: string; timestamp: number };
}

export async function createPost(
  accessToken: string,
  body: {
    mediaType: "PHOTO" | "VIDEO" | "AUDIO";
    mediaUrl: string;
    cloudinaryPublicId?: string;
    folder?: string;
    text?: string;
    country?: string;
    city?: string;
    lat?: number;
    lng?: number;
  },
): Promise<{ post: ApiPost }> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Create post failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { post: ApiPost };
}

export async function deletePost(
  accessToken: string,
  postId: string,
): Promise<{ ok: boolean }> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/posts/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await readApiError(res);
    throw new Error(`Delete post failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { ok: boolean };
}

