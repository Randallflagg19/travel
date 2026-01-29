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
  unknown: {
    count: number;
  };
};

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Create .env.local from .env.local.example.",
    );
  }
  return url.replace(/\/+$/, "");
}

export async function fetchPostsPage(params: {
  limit: number;
  cursor?: string;
  order?: "asc" | "desc";
  country?: string;
  city?: string;
  unknown?: boolean;
}): Promise<PostsPage> {
  const api = getApiBaseUrl();
  const search = new URLSearchParams();
  search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.order) search.set("order", params.order);
  if (params.country) search.set("country", params.country);
  if (params.city) search.set("city", params.city);
  if (params.unknown) search.set("unknown", "true");

  const res = await fetch(`${api}/posts?${search.toString()}`, {
    // This is a client-side fetch; rely on TanStack Query caching.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load posts (${res.status}): ${text}`);
  }

  return (await res.json()) as PostsPage;
}

export async function fetchPlaces(): Promise<PlacesResponse> {
  const api = getApiBaseUrl();
  const res = await fetch(`${api}/places`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load places (${res.status}): ${text}`);
  }
  return (await res.json()) as PlacesResponse;
}

