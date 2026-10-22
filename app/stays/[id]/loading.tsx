import { Block, HeaderSkeleton } from "@/components/Skeletons";

// A stay page while it renders: title row, the photo collage, and the booking
// card beside the facts — the page's own shape, so nothing jumps when it lands.
export default function Loading() {
  return (
    <main className="min-h-full">
      <HeaderSkeleton narrow />
      <div className="mx-auto max-w-[1104px] px-5 py-8 sm:px-6" aria-busy="true" aria-label="Loading this stay">
        <Block className="h-4 w-20" />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <Block className="h-7 w-28 rounded-full" />
            <Block className="mt-3 h-11 w-full max-w-[460px]" />
            <Block className="mt-3 h-4 w-40" />
          </div>
          <Block className="h-10 w-36" />
        </div>
        <div className="mt-5 grid h-[520px] grid-cols-2 grid-rows-[2.2fr_1fr_1fr] gap-2 overflow-hidden rounded-[28px] sm:h-[460px] sm:grid-cols-4 sm:grid-rows-2">
          <Block className="col-span-2 rounded-none sm:row-span-2" />
          {Array.from({ length: 4 }, (_, i) => (
            <Block key={i} className="rounded-none" />
          ))}
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Block className="h-5 w-48" />
            <Block className="h-24 w-full rounded-[22px]" />
            <Block className="h-7 w-56" />
            <Block className="h-4 w-full" />
            <Block className="h-4 w-11/12" />
            <Block className="h-4 w-4/5" />
          </div>
          <Block className="order-first h-[420px] rounded-[22px] lg:order-none" />
        </div>
      </div>
    </main>
  );
}
