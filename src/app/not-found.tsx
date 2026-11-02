import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you are looking for doesn&apos;t exist or was moved.</p>
      <Link href="/" className="btn-primary mt-6">Back to store</Link>
    </div>
  );
}
