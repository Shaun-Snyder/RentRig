export default function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 pb-3 border-b border-slate-200">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
        {title}
      </h1>

      {subtitle && (
        <p className="mt-0.5 text-sm text-slate-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}
