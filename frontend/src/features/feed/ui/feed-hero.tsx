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
  photoSrc = "/me-hero.jpg",
  tagline = "Путешествие, к которому хочется возвращаться.",
}: FeedHeroProps) {
  return (
    <section className="overflow-hidden rounded-[1.25rem] bg-[#070d10] shadow-[0_28px_90px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
      <div className="relative aspect-[8/5] w-full max-w-[1672px] [container-type:inline-size] lg:aspect-[1672/941]">
        <Image
          src="/first-screen/journal-template-mobile.png"
          alt="Открытый дорожный журнал на тёмном столе"
          fill
          priority
          className="object-cover lg:hidden"
          sizes="(max-width: 1023px) calc(100vw - 32px), 920px"
        />
        <Image
          src="/first-screen/journal-template-clean.png"
          alt="Открытый дорожный журнал на тёмном столе"
          fill
          priority
          className="hidden object-cover lg:block"
          sizes="(min-width: 1024px) calc(100vw - 364px), 920px"
        />

        {/* Inner photo window in the mobile 1440 × 900 crop: (793, 121)–(1211, 584). */}
        <div
          className="absolute overflow-hidden bg-stone-200 shadow-[inset_0_0_0_1px_rgba(74,54,33,0.2)] lg:hidden"
          style={{
            left: `${(793 / 1440) * 100}%`,
            top: `${(121 / 900) * 100}%`,
            width: `${(418 / 1440) * 100}%`,
            height: `${(463 / 900) * 100}%`,
          }}
        >
          <Image
            src={photoSrc}
            alt="Фотография из путешествия"
            fill
            priority
            unoptimized
            className="object-cover object-center"
            sizes="(max-width: 1023px) 31vw, 25vw"
          />
        </div>

        {/* Inner photo window in the 1672 × 941 desktop bitmap: (909, 141)–(1327, 604). */}
        <div
          className="absolute hidden overflow-hidden bg-stone-200 shadow-[inset_0_0_0_1px_rgba(74,54,33,0.2)] lg:block"
          style={{
            left: `${(909 / 1672) * 100}%`,
            top: `${(141 / 941) * 100}%`,
            width: `${(418 / 1672) * 100}%`,
            height: `${(463 / 941) * 100}%`,
          }}
        >
          <Image
            src={photoSrc}
            alt="Фотография из путешествия"
            fill
            priority
            unoptimized
            className="object-cover object-center"
            sizes="25vw"
          />
        </div>

        <div className="pointer-events-none absolute hidden left-[14.45%] top-[13.6%] h-[69.4%] w-[37.7%] flex-col items-center text-center text-[#4f3a2a] [font-family:Georgia,'Times_New_Roman',serif] lg:flex">
          <p className="text-[1.02cqw] italic leading-none text-[#5f4936]">
            {eyebrow}
          </p>

          <div className="mt-[4.2%] grid w-full grid-rows-[3.45cqw_1.55cqw] justify-items-center gap-[0.55cqw]">
            <p className="flex max-w-full items-center justify-center whitespace-nowrap text-[3.2cqw] font-normal leading-none">
              {title}
            </p>
            <p className="flex items-center justify-center text-[1.42cqw] italic leading-none text-[#6b5139]">
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

        <div className="pointer-events-none absolute left-[8.72%] top-[12%] flex h-[72.6%] w-[43.8%] flex-col items-center text-center text-[#4f3a2a] [font-family:Georgia,'Times_New_Roman',serif] lg:hidden">
          <p className="text-[1.02cqw] italic leading-none text-[#5f4936]">
            {eyebrow}
          </p>

          <div className="mt-[4.2%] grid w-full grid-rows-[3.45cqw_1.55cqw] justify-items-center gap-[0.55cqw]">
            <p className="flex max-w-full items-center justify-center whitespace-nowrap text-[3.2cqw] font-normal leading-none">
              {title}
            </p>
            <p className="flex items-center justify-center text-[1.42cqw] italic leading-none text-[#6b5139]">
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

        <div className="pointer-events-none absolute hidden left-[55.7%] top-[68.7%] h-[12.1%] w-[22.8%] items-center justify-center px-[2.1%] text-center text-[#5b402c] [font-family:Georgia,serif] lg:flex">
          <p className="text-[1.25cqw] italic leading-[1.22]">
            {tagline}
          </p>
        </div>

        <div className="pointer-events-none absolute left-[56.6%] top-[69.6%] flex h-[12.7%] w-[26.5%] items-center justify-center px-[2.1%] text-center text-[#5b402c] [font-family:Georgia,serif] lg:hidden">
          <p className="text-[1.25cqw] italic leading-[1.22]">
            {tagline}
          </p>
        </div>
      </div>
    </section>
  );
}
