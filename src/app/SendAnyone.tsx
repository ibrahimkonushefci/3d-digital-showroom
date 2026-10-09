import { Share2 } from "lucide-react";
import { useT } from "../i18n";
import { sendAnyone } from "../sharing";
export function SendAnyone({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url: string;
}) {
  const t = useT();
  return (
    <button
      className="button secondary full"
      onClick={() => sendAnyone(title, text, url)}
    >
      <Share2 size={17} />
      {t("sendAnyone")}
    </button>
  );
}
