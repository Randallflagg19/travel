import Image from "next/image";

export function FeedHero({
  title,
  postsCount,
  isSelectionReady,
}: {
  title: string;
  postsCount: number;
  isSelectionReady: boolean;
}) {
  return (
    <>
      <section className="lg:hidden">
        <div className="travel-card-glow relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/10 bg-[#071014]">
          <Image
            src="/me.png"
            alt="Tapir Travel"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,14,0.04)_0%,rgba(5,10,14,0.1)_48%,rgba(5,10,14,0.36)_100%)]" />
        </div>

        <div className="travel-card-glow relative z-10 -mt-12 rounded-[1.7rem] border border-white/10 bg-[#071014]/88 p-6 backdrop-blur-xl">
          <p className="font-serif text-xl italic text-amber-200/88">
            личный журнал дороги
          </p>
          <h1 className="mt-2 font-serif text-5xl font-semibold italic leading-none tracking-tight text-amber-100">
            {title}
          </h1>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-white/72">
            Не отчёт. Просто места и детали, которые хочется помнить.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.22em] text-emerald-200/72">
            <span>{postsCount ? `${postsCount} кадров` : "выбери главу"}</span>
          </div>
        </div>
      </section>

      <section className="travel-card-glow relative hidden overflow-hidden rounded-[2rem] border border-white/10 bg-[#071014] lg:block">
        <div className="absolute inset-y-0 right-0 hidden w-[58%] overflow-hidden lg:block">
          <Image
            src="/me.png"
            alt="Tapir Travel"
            fill
            priority
            className="object-cover object-center opacity-88"
            sizes="58vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,16,20,0.92)_0%,rgba(7,16,20,0.2)_34%,rgba(7,16,20,0.18)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_18%,rgba(245,166,76,0.18),transparent_30%)]" />
        </div>
        <Image
          src="/me.png"
          alt="Tapir Travel"
          fill
          priority
          className="object-cover object-center opacity-35 lg:hidden"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,14,0.98)_0%,rgba(5,10,14,0.9)_42%,rgba(5,10,14,0.3)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(48,196,143,0.22),transparent_34%),radial-gradient(circle_at_84%_30%,rgba(245,166,76,0.16),transparent_30%)]" />

        <div className="relative flex min-h-[330px] items-center px-6 py-10 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="mb-4 font-serif text-2xl italic text-amber-200/90">
              личный журнал дороги
            </p>
            <h1 className="font-serif text-5xl font-semibold italic tracking-tight text-amber-100 sm:text-6xl lg:text-7xl xl:text-8xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
              Места, в которых я оказался. Люди, которых встретил. Странные
              детали, случайные находки и фотографии, которые захотелось
              оставить себе.
            </p>
            {!isSelectionReady ? (
              <p className="mt-5 text-sm font-medium uppercase tracking-[0.26em] text-emerald-200/70">
                Выбери главу слева или открой все посты
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
