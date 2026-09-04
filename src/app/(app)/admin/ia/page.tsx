import { getSettings } from "@/lib/settings";
import AISettingsForm from "@/components/admin/AISettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminIA() {
  const settings = await getSettings();
  const keys = {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY)
  };
  return <AISettingsForm initial={settings} keys={keys} />;
}
