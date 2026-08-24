import type { Metadata } from "next";
import Link from "next/link";

const services = [
  {
    name: "Logopedski tretman",
    duration: "45 minuta",
    slug: "logopedski-tretman",
  },
  {
    name: "Defektološki tretman",
    duration: "45 minuta",
    slug: "defektoloski-tretman",
  },
  {
    name: "Inicijalna procena",
    duration: "60 minuta",
    slug: "inicijalna-procena",
  },
  {
    name: "Kontrolni pregled",
    duration: "30 minuta",
    slug: "kontrolni-pregled",
  },
];

export const metadata: Metadata = {
  title: "Zakažite termin | Centar za razvoj i rehabilitaciju",
  description: "Izaberite vrstu usluge za željeni termin.",
};

export default function BookingPage() {
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
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267]"
          >
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#397267] text-lg font-semibold text-white shadow-sm"
            >
              C
            </span>
            <span className="hidden text-sm leading-snug font-semibold tracking-tight text-[#243c38] sm:block sm:text-base">
              Centar za razvoj i rehabilitaciju
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#397267] transition hover:bg-white/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267] sm:px-4"
          >
            <span aria-hidden="true">←</span>
            Nazad na početnu
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1">
        <section className="mx-auto w-full max-w-4xl px-6 py-16 sm:px-8 sm:py-24 lg:px-10">
          <div className="text-center sm:text-left">
            <p className="mb-4 text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
              Prvi korak
            </p>
            <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
              Zakažite termin
            </h1>
            <p className="mt-4 text-lg text-[#526b66] sm:text-xl">
              Izaberite vrstu usluge
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5">
            {services.map((service) => (
              <Link
                key={service.name}
                href={{
                  pathname: "/booking/therapists",
                  query: { service: service.slug },
                }}
                className="group flex min-h-32 cursor-pointer items-center justify-between gap-5 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 text-left shadow-[0_12px_35px_rgba(36,60,56,0.06)] transition hover:-translate-y-0.5 hover:border-[#397267]/30 hover:bg-white hover:shadow-[0_16px_40px_rgba(36,60,56,0.1)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
              >
                <span>
                  <span className="block text-lg font-semibold text-[#243c38]">
                    {service.name}
                  </span>
                  <span className="mt-2 block text-sm font-medium text-[#6b807c]">
                    {service.duration}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e2f0e7] text-lg text-[#397267] transition group-hover:bg-[#397267] group-hover:text-white"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
