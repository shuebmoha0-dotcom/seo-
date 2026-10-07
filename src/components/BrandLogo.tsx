import Link from "next/link";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string | null;
  textColor?: string;
}

export function BrandLogo({
  className = "",
  size = "md",
  href = "/",
  textColor = "text-neutral-950",
}: BrandLogoProps) {
  const sizeMap = {
    sm: {
      box: "h-6 w-6 rounded-md",
      svg: "h-3 w-3",
      text: "text-sm",
      dot: "w-1 h-1",
    },
    md: {
      box: "h-7 w-7 rounded-lg",
      svg: "h-3.5 w-3.5",
      text: "text-base",
      dot: "w-1.5 h-1.5",
    },
    lg: {
      box: "h-9 w-9 rounded-xl",
      svg: "h-4.5 w-4.5",
      text: "text-xl",
      dot: "w-2 h-2",
    },
  };

  const s = sizeMap[size];

  const content = (
    <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      <div
        className={`flex ${s.box} items-center justify-center bg-neutral-950 text-white shadow-xs group-hover:bg-indigo-600 transition-colors`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${s.svg} -rotate-45 translate-x-0.5 -translate-y-0.5`}
        >
          <polygon points="3 3 21 10 13 13 10 21 3 3" fill="currentColor" fillOpacity="0.2" />
        </svg>
      </div>
      <span className={`font-extrabold tracking-tight ${textColor} ${s.text} flex items-center`}>
        Outdart
        <span className={`${s.dot} rounded-full bg-indigo-600 ml-1 inline-block`} />
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}
