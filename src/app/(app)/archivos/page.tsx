import { FolderDown } from "lucide-react";
import MyFiles from "@/components/MyFiles";

export const dynamic = "force-dynamic";

export default function ArchivosPage() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <FolderDown className="w-4 h-4 text-[var(--clr-brand2)]" /> Mis archivos
      </div>
      <MyFiles />
    </div>
  );
}
