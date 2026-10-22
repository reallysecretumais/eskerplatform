import { Block, CardSkeleton, HeaderSkeleton } from "@/components/Skeletons";

// /stays while it renders: the heading, the Ask Esker bar, the filter pills and
// the 3-across grid, in the shapes they arrive in.
export default function Loading() {
  return (
    <main className="min-h-full">
      <HeaderSkeleton />
      <div className="mx-auto max-w-[1248px] px-5 pb-16 pt-8 sm:px-6 sm:pt-10" aria-busy="true" aria-label="Loading stays">
        <Block className="h-12 w-64 sm:h-14" />
        <Block className="mt-6 h-[58px] max-w-[640px] rounded-full" />
        <div className="mt-6 flex flex-wrap gap-2">
          {[64, 104, 104, 112, 64].map((w, i) => (
            <Block key={i} className="h-[38px] rounded-full" style={{ width: w }} />
          ))}
        </div>
        <Block className="mb-6 mt-8 h-3 w-20" />
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
