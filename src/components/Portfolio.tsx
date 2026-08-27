"use client";

import { useEffect, useState } from "react";
import { Briefcase, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Item {
  id: string;
  title: string;
  type: string;
  description: string;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  proyecto: "🧩",
  ensayo: "📝",
  certificado: "🎓",
  evidencia: "📎"
};

export default function Portfolio() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("proyecto");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/portfolio");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, type, description })
    });
    setTitle("");
    setDescription("");
    setShowForm(false);
    setSaving(false);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <Briefcase className="w-4 h-4 text-[var(--clr-brand2)]" /> Portafolio
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1 text-[12px] bg-[var(--clr-brand2)] hover:bg-brand text-white px-3 py-1.5 rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" /> Añadir evidencia
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card space-y-2.5">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            className="w-full text-[13px] px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none focus:border-[var(--clr-brand2)]"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full text-[13px] px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none"
          >
            <option value="proyecto">Proyecto</option>
            <option value="ensayo">Ensayo</option>
            <option value="certificado">Certificado</option>
            <option value="evidencia">Evidencia</option>
          </select>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción"
            rows={3}
            className="w-full text-[13px] px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none focus:border-[var(--clr-brand2)]"
          />
          <button
            disabled={saving}
            className="flex items-center gap-2 bg-[var(--clr-brand2)] hover:bg-brand text-white text-[13px] font-medium px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
        </form>
      )}

      <div className="card">
        {loading && <div className="text-[12px] text-[var(--text-tertiary)]">Cargando…</div>}
        {!loading && items.length === 0 && (
          <div className="text-[12px] text-[var(--text-tertiary)]">
            Aún no has agregado evidencias a tu portafolio.
          </div>
        )}
        <div className="divide-y divide-[var(--border-tertiary)]">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2.5 py-2">
              <div className="w-9 h-9 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-base shrink-0">
                {TYPE_ICON[it.type] ?? "📎"}
              </div>
              <div>
                <div className="text-[12px] font-medium">{it.title}</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">
                  {format(new Date(it.createdAt), "d 'de' MMMM, yyyy", { locale: es })} · {it.type}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
