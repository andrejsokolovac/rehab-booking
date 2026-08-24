import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#fffaf3] text-[#243c38]">
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#e2f0e7] sm:h-96 sm:w-96"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-28 -left-28 h-64 w-64 rounded-full bg-[#f9dfcb] sm:h-80 sm:w-80"
      />

      <header className="relative z-10 border-b border-[#243c38]/8">
        <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-2xl bg-[#397267] text-lg font-semibold text-white shadow-sm"
            >
              C
            </span>
            <p className="max-w-56 text-sm leading-snug font-semibold tracking-tight text-[#243c38] sm:max-w-none sm:text-base">
              Centar za razvoj i rehabilitaciju
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center">
        <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-32">
          <div className="max-w-3xl">
            <p className="mb-6 inline-flex rounded-full border border-[#397267]/15 bg-white/70 px-4 py-2 text-sm font-medium text-[#397267] shadow-sm backdrop-blur-sm">
              Podrška. Razumevanje. Razvoj.
            </p>
            <h1 className="max-w-3xl text-5xl leading-[1.06] font-semibold tracking-[-0.04em] text-balance text-[#243c38] sm:text-6xl lg:text-7xl">
              Podrška razvoju svakog deteta
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#526b66] sm:text-xl sm:leading-9">
              Pružamo stručnu i posvećenu podršku deci i roditeljima kroz
              individualni pristup, rehabilitaciju i logopedski rad u sigurnom
              i podsticajnom okruženju.
            </p>
            <Link
              href="/booking"
              className="mt-10 inline-flex min-h-13 cursor-pointer items-center justify-center rounded-full bg-[#397267] px-7 py-3.5 text-base font-semibold text-white shadow-[0_12px_30px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267]"
            >
              Zakaži termin
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
