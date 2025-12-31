export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="text-sm font-medium text-zinc-900">{title}</div>
      <div className="mt-2 text-sm text-zinc-600">Pantalla en construcción.</div>
    </div>
  );
}