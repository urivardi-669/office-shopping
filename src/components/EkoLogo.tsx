export default function EkoLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = {
    sm: "h-6 px-2.5 text-xs",
    md: "h-8 px-3.5 text-sm",
    lg: "h-11 px-5 text-lg",
  }[size];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-neutral-950 font-semibold tracking-tight text-white ${dims}`}
    >
      eko
    </span>
  );
}
