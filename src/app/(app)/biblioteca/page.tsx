import { Library } from "lucide-react";
import LibrarySearch from "@/components/LibrarySearch";

export default function BibliotecaPage() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Library className="w-4 h-4 text-[var(--clr-brand2)]" /> Biblioteca IA
      </div>
      <LibrarySearch />
    </div>
  );
}
