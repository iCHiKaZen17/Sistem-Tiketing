import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        WhatsApp Ticketing System
      </h1>
      <p className="mt-4 text-lg text-slate-600 max-w-xl">
        Sistem manajemen tiket laporan kendala aplikasi internal.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          Masuk Dashboard
        </Link>
      </div>
    </main>
  );
}
