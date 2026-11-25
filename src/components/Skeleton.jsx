export function LayoutSkeleton(){
 return <div data-layout-skeleton className="flex h-dvh overflow-hidden">
  <aside aria-hidden="true" className="hidden lg:flex flex-col w-64 shrink-0 h-dvh overflow-hidden bg-white dark:bg-gray-800 p-4 rounded-r-2xl shadow-sm">
   <div className="mb-12 mt-2 px-2"><Skeleton rows={1}/></div>
   <Skeleton rows={6}/>
   <div className="mt-auto border-t border-gray-100 dark:border-gray-700/60"><Skeleton rows={2}/></div>
  </aside>
  <div className="flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
   <header aria-hidden="true" className="shrink-0 px-4 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between h-16 lg:border-b border-gray-200 dark:border-gray-700/60">
     <div data-skeleton className="w-6 h-6 lg:invisible rounded bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse"/>
     <div className="flex gap-3">{[0,1].map(i=><div key={i} data-skeleton className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse"/>)}</div>
    </div>
   </header>
   <main className="grow px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
    <div aria-hidden="true" className="mb-8 space-y-3"><div data-skeleton className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse"/><div data-skeleton className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse"/></div>
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm p-5"><Skeleton label="Loading session"/></div>
   </main>
  </div>
 </div>;
}

export default function Skeleton({label='Loading content',rows=5}){
 return <div role="status" aria-label={label} aria-busy="true" className="w-full space-y-4 py-4"><span className="sr-only">{label}…</span><div aria-hidden="true" className="space-y-4">{Array.from({length:rows},(_,i)=><div key={i} data-skeleton-row className="flex items-center gap-4"><div data-skeleton className="h-10 w-10 shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse"/><div className="min-w-0 flex-1 space-y-2"><div data-skeleton className={`h-3 rounded bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse ${i%2?'w-2/3':'w-3/4'}`}/><div data-skeleton className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-700/60 motion-safe:animate-pulse"/></div></div>)}</div></div>;
}
