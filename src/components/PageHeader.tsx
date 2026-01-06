export default function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1
  className="
  text-4xl font-extrabold text-black
  [text-shadow:_3px_3px_0_#fff,_-3px_3px_0_#fff,_3px_-3px_0_#fff,_-3px_-3px_0_#fff]
"
>
  {title}
</h1>

      {subtitle && (
        <p className="mt-1 rr-subtext">
          {subtitle}
        </p>
      )}
    </div>
  );
}
