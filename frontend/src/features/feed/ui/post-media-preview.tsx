import type { ApiPost } from "@/shared/api/api";
import {
  cloudinaryFullUrl,
  cloudinaryThumbUrl,
  cloudinaryVideoPosterUrl,
} from "@/shared/lib/cloudinary";
import { Play } from "lucide-react";
import Image from "next/image";

type PostMediaPreviewProps = {
  post: ApiPost;
  onOpen: (postId: string) => void;
};

function preloadExpandedMedia(post: ApiPost) {
  if (post.media_type !== "PHOTO") return;
  if (typeof window === "undefined") return;
  const img = new window.Image();
  img.src = cloudinaryFullUrl(post.media_url, post.media_type);
}

export function PostMediaPreview({ post, onOpen }: PostMediaPreviewProps) {
  return post.media_type === "VIDEO" ? (
    <button
      type="button"
      className="relative block w-full cursor-zoom-in overflow-hidden"
      onClick={() => onOpen(post.id)}
      aria-label="Открыть видео"
    >
      {post.cloudinary_public_id ? (
        <Image
          className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          alt={post.text ?? "travel video"}
          src={
            cloudinaryVideoPosterUrl(
              post.media_url,
              post.cloudinary_public_id,
              {
                width: 600,
              },
            ) ?? cloudinaryThumbUrl(post.media_url, post.media_type)
          }
          width={720}
          height={540}
          sizes="(max-width: 768px) 100vw, 720px"
          unoptimized
        />
      ) : (
        <video
          className="pointer-events-none aspect-[4/3] w-full object-cover"
          playsInline
          muted
          preload="metadata"
          src={post.media_url}
        />
      )}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30 backdrop-blur transition duration-300 group-hover:scale-110">
          <Play className="ml-0.5 size-6 fill-white" />
        </div>
      </div>
    </button>
  ) : (
    <button
      type="button"
      className="block w-full cursor-zoom-in overflow-hidden"
      onClick={() => onOpen(post.id)}
      onFocus={() => preloadExpandedMedia(post)}
      onPointerEnter={() => preloadExpandedMedia(post)}
      onPointerDown={() => preloadExpandedMedia(post)}
    >
      <Image
        className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.035]"
        alt={post.text ?? "travel media"}
        src={cloudinaryThumbUrl(post.media_url, post.media_type)}
        width={720}
        height={540}
        sizes="(max-width: 768px) 100vw, 720px"
        unoptimized
      />
    </button>
  );
}
