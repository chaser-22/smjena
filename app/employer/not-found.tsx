import Link from 'next/link';
export default function NotFound() { return <main id="main-content" className="p-8"><h1 className="text-2xl font-bold">Oglas nije dostupan ovoj firmi</h1><Link href="/employer/shifts" className="inline-flex min-h-11 items-center underline">Izaberi firmu</Link></main>; }
