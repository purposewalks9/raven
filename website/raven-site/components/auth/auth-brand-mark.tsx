import Link from "next/link";

export function AuthBrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path
          d="M10 10 C10 10, 10 22, 16 22 C22 22, 22 16, 22 16"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="22" cy="22" r="2.5" fill="white" />
      </svg>
      <span className="font-semibold text-[15px] tracking-tight">Hookraft</span>
    </Link>
  );
}