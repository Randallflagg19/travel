type HeroPhoto = {
  src: string;
  alt: string;
  position?: string;
  unoptimized: boolean;
};

const JOURNAL_COVER: HeroPhoto = {
  src: "/me-hero.jpg",
  alt: "Фотография из Паттайи",
  unoptimized: false,
};

const HERO_PHOTOS: Record<string, HeroPhoto | null> = {
  "Thailand/Pattaya": JOURNAL_COVER,
  "Thailand/Bangkok": {
    src: "/hero-photos/thailand-bangkok-giraffes.jpg",
    alt: "Фотография из Бангкока: путешественник у жирафов",
    position: "50% 43%",
    unoptimized: true,
  },
  "Indonesia/Bali": {
    src: "/hero-photos/indonesia-bali-temple.jpg",
    alt: "Фотография с Бали у храма",
    position: "58% center",
    unoptimized: true,
  },
  Egypt: {
    src: "/hero-photos/egypt-giza-pyramid.jpg",
    alt: "Фотография из Египта у пирамиды",
    position: "45% 56%",
    unoptimized: true,
  },
  China: JOURNAL_COVER,
};

export function selectHeroPhoto({
  all,
  country,
  city,
}: {
  all: boolean;
  country: string;
  city: string;
}): HeroPhoto | null {
  if (all) return JOURNAL_COVER;

  const exactPlace = city ? `${country}/${city}` : "";
  if (exactPlace && exactPlace in HERO_PHOTOS)
    return HERO_PHOTOS[exactPlace];

  if (country in HERO_PHOTOS) return HERO_PHOTOS[country];

  return JOURNAL_COVER;
}
