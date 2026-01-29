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
}): Promise<PostsPage> {
  const api = getApiBaseUrl();
  const search = new URLSearchParams();
  search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

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

