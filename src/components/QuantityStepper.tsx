"use client";

export default function QuantityStepper({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-2 select-none">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-full border border-neutral-300 text-neutral-600 hover:bg-neutral-100 flex items-center justify-center font-bold disabled:opacity-40"
        disabled={value <= min}
        aria-label="הפחת"
      >
        −
      </button>
      <span className="w-6 text-center font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-full border border-violet-300 text-violet-600 hover:bg-violet-50 flex items-center justify-center font-bold"
        aria-label="הוסף"
      >
        +
      </button>
    </div>
  );
}
