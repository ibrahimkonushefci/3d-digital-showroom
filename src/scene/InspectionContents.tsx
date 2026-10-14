import { useEffect, useState, type ReactNode } from "react";
/** Keep real interiors during closing; hide only once the front has settled. */
export function InspectionContents({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  const [closing, setClosing] = useState(visible);
  useEffect(() => {
    if (visible) {
      setClosing(true);
      return;
    }
    const timer = setTimeout(() => setClosing(false), 900);
    return () => clearTimeout(timer);
  }, [visible]);
  return <group visible={visible || closing}>{children}</group>;
}
