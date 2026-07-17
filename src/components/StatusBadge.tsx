type StatusBadgeProps = {
  status?: string | null;
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const value = String(status ?? "unknown");

  const normalized = value.toLowerCase();

  let colors = "bg-slate-200 text-slate-700";

  switch (normalized) {
    case "approved":
    case "completed":
    case "fully_refunded":
      colors = "bg-green-100 text-green-800";
      break;

    case "pending":
    case "requested":
    case "partially_refunded":
      colors = "bg-amber-100 text-amber-800";
      break;

    case "active":
    case "collected":
      colors = "bg-blue-100 text-blue-800";
      break;

    case "rejected":
    case "cancelled":
    case "retained":
      colors = "bg-red-100 text-red-800";
      break;
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ${colors}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
