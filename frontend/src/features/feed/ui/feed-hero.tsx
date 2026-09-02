import Image from "next/image";
import { Camera, Video } from "lucide-react";

type FeedHeroProps = {
  eyebrow?: string;
  title?: string;
  year?: string;
  photosCount?: number;
  videosCount?: number;
  photoSrc?: string;
  tagline?: string;
};

export function FeedHero({
  eyebrow = "Личный журнал дороги",
  title = "Indonesia: Bali",
  year = "2026",
  photosCount = 450,
  videosCount = 9,
  photoSrc = "/me.png",
  tagline = "Путешествие, к которому хочется возвращаться.",
}: FeedHeroProps) {
  return (
    <section className="overflow-hidden rounded-[1.25rem] bg-[#070d10] shadow-[0_28px_90px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
      <div className="relative aspect-[1672/941] w-full max-w-[1672px] [container-type:inline-size]">
        <Image
          src="/first-screen/journal-template-clean.png"
          alt="Открытый дорожный журнал на тёмном столе"
          fill
          priority
          className="object-cover"
          sizes="(min-width: 1024px) calc(100vw - 364px), 920px"
        />

        <div className="absolute left-[54.62%] top-[15.50%] h-[49.10%] w-[25.12%] overflow-hidden bg-stone-200 shadow-[inset_0_0_0_1px_rgba(74,54,33,0.2)]">
          <Image
            src={photoSrc}
            alt="Фотография из путешествия"
            fill
            priority
            className="object-cover object-center"
            sizes="(min-width: 1024px) 25vw, 230px"
          />
        </div>

        <div className="pointer-events-none absolute left-[14.45%] top-[13.6%] flex h-[69.4%] w-[37.7%] flex-col items-center text-center text-[#4f3a2a] [font-family:Georgia,'Times_New_Roman',serif]">
          <p className="text-[1.02cqw] italic leading-none text-[#5f4936]">
            {eyebrow}
          </p>

          <div className="mt-[4.2%] flex flex-col items-center">
            <p className="text-[3.2cqw] font-normal leading-none">
              {title}
            </p>
            <p className="mt-[4.6%] text-[1.42cqw] italic leading-none text-[#6b5139]">
              {year}
            </p>
          </div>

          <div className="mt-auto mb-[2.4%] flex flex-col gap-[0.5cqw] text-left font-sans text-[0.86cqw] leading-none text-[#4f3a2a]">
            <span className="flex items-center gap-[0.45cqw]">
              <Camera className="size-[0.9cqw]" strokeWidth={2.35} />
              {photosCount} фото
            </span>
            <span className="flex items-center gap-[0.45cqw]">
              <Video className="size-[0.9cqw]" strokeWidth={2.35} />
              {videosCount} видео
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute left-[55.7%] top-[68.7%] flex h-[12.1%] w-[22.8%] items-center justify-center px-[2.1%] text-center text-[#5b402c] [font-family:Georgia,serif]">
          <p className="text-[1.25cqw] italic leading-[1.22]">
            {tagline}
          </p>
        </div>
      </div>
    </section>
  );
}
