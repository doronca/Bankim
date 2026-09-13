// Isolates left-to-right content (dates, signed amounts) from the
// surrounding RTL text flow so the Unicode bidi algorithm can't reorder
// digits/punctuation around a neutral character like "/" or "-".
export default function Ltr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  );
}
