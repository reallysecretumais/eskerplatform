import { Block, HeaderSkeleton } from "@/components/Skeletons";

// Checkout while it renders (it checks the dates and reads the bank accounts
// first): the form on the left, the order summary on the right.
export default function Loading() {
  return (
    <main className="min-h-full pb-16">
      <HeaderSkeleton narrow />
      <div className="mx-auto max-w-[1104px] px-5 py-8 sm:px-6" aria-busy="true" aria-label="Checking your dates">
        <Block className="h-4 w-28" />
        <Block className="mt-4 h-11 w-72" />
        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Block className="h-7 w-40" />
            <Block className="h-12 w-full" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Block className="h-12" />
              <Block className="h-12" />
            </div>
            <Block className="mt-6 h-7 w-44" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Block className="h-16 rounded-[20px]" />
              <Block className="h-16 rounded-[20px]" />
            </div>
            <Block className="mt-4 h-[58px] w-full rounded-full" />
          </div>
          <Block className="h-[440px] rounded-[22px]" />
        </div>
      </div>
    </main>
  );
}
