import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-6xl font-bold text-gray-200">404</div>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          Page not found
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg bg-[#1496E8] px-4 py-2 text-sm font-medium text-white hover:bg-[#0d7bc4] transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
