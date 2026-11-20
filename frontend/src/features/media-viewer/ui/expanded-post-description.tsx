import type { ApiPost } from "@/shared/api/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

type ExpandedPostDescriptionProps = {
  post: ApiPost;
  desktopVisible: boolean;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
};

export function ExpandedPostDescription({
  post,
  desktopVisible,
  sheetOpen,
  onSheetOpenChange,
}: ExpandedPostDescriptionProps) {
  if (!post.title && !post.text) return null;

  return (
    <>
      {desktopVisible ? (
        <aside
          aria-label="Описание поста"
          className="hidden min-h-0 w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b1519] lg:flex xl:w-[360px]"
        >
          <div key={post.id} className="min-h-0 overflow-y-auto overscroll-contain p-5 [overflow-wrap:anywhere]">
            {post.title ? <h2 className="font-serif text-2xl leading-tight">{post.title}</h2> : null}
            {post.text ? <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-amber-50/80">{post.text}</p> : null}
          </div>
        </aside>
      ) : null}
      <section
        aria-label="Краткое описание поста"
        className="shrink-0 rounded-xl border border-white/15 bg-[#0b1519] px-4 py-3 [overflow-wrap:anywhere] lg:hidden"
      >
        {post.title ? <h2 className="line-clamp-1 font-serif text-lg leading-tight">{post.title}</h2> : null}
        {post.text ? <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-50/80">{post.text}</p> : null}
        <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
          <SheetTrigger asChild>
            <button type="button" className="mt-1 min-h-11 cursor-pointer text-sm text-[#83c8b6] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Развернуть описание
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            aria-describedby={undefined}
            onClose={() => onSheetOpenChange(false)}
            className="max-h-[80dvh] gap-0 overflow-hidden rounded-t-2xl border-white/15 bg-[#0b1519] text-amber-50"
          >
            <SheetHeader className="shrink-0 border-b border-white/10 pr-14">
              <SheetTitle className="text-amber-50">Описание поста</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] [overflow-wrap:anywhere]">
              {post.title ? <h2 className="font-serif text-2xl leading-tight">{post.title}</h2> : null}
              {post.text ? <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-amber-50/80">{post.text}</p> : null}
            </div>
          </SheetContent>
        </Sheet>
      </section>
    </>
  );
}
