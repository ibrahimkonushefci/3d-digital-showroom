import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils } from "three";
import type { Placement } from "../doorPreview/types";
import type { Catalog } from "../catalog/types";
import { useBrand } from "../brand";
import { useQuality } from "./quality";
import { createProduct, disposeProduct } from "./products";
export function Product({
  item,
  catalog,
  onClick,
  open = false,
}: {
  item: Placement;
  catalog: Catalog;
  onClick?: () => void;
  open?: boolean;
}) {
  const { assetUrl } = useBrand(),
    performance = useQuality() === "lightweight",
    { invalidate } = useThree();
  const object = useMemo(
    () => createProduct(item, catalog, assetUrl, performance),
    [item, catalog, assetUrl, performance],
  );
  const a = useRef(0);
  useEffect(() => {
    invalidate();
    const timeout = setTimeout(invalidate, 400);
    return () => {
      clearTimeout(timeout);
      disposeProduct(object);
    };
  }, [object, invalidate]);
  useFrame((_, dt) => {
    const target = open ? -1.2 : 0;
    a.current = MathUtils.damp(a.current, target, 7, dt);
    const leaf = object.getObjectByName("leaf");
    if (leaf) {
      leaf.rotation.y = a.current;
      leaf.position.x = open ? -0.15 : 0;
    }
    if (Math.abs(a.current - target) > 0.001) invalidate();
  });
  return (
    <primitive
      object={object}
      onClick={
        onClick
          ? (e: { stopPropagation: () => void }) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    />
  );
}
