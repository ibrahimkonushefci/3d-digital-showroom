import { useMemo } from "react";
import type { Catalog, DesignDocument } from "../../catalog/types";
import { resolveRoom } from "./resolveRoom";
import { ModelAsset } from "../assets/ModelAsset";
import { Box } from "../Primitives";
import { countertopThickness } from "../furnitureMaterials";
import { freePlacement } from "../assets/placement";
export function RoomProps({
  design,
  catalog,
}: {
  design: DesignDocument;
  catalog: Catalog;
}) {
  const room = useMemo(() => resolveRoom(design), [design]);
  const counter =
    room.furnished && design.kind === "kitchen"
      ? design.cabinets.find(
          (c) =>
            c.level === "base" &&
            c.width >= 60 &&
            catalog.modules.find((m) => m.id === c.moduleId)?.type === "doors",
        )
      : undefined;
  const bench = room.props.find((p) => p.id === "bench");
  const rug =
    bench &&
    freePlacement(
      {
        min: [bench.position[0] - 0.66, 0, bench.position[2] - 0.31],
        max: [bench.position[0] + 0.66, 0.006, bench.position[2] + 0.43],
      },
      design,
    );
  return (
    <group userData={{ reflectionStatic: true }}>
      {bench && rug && (
        <mesh
          position={[bench.position[0], 0.003, bench.position[2] + 0.06]}
          receiveShadow
          raycast={() => {}}
        >
          <boxGeometry args={[1.32, 0.006, 0.74]} />
          <meshStandardMaterial
            color={room.recipe.finishes.rug}
            roughness={1}
          />
        </mesh>
      )}
      {[...new Set(room.props.map((p) => p.id))].map((id) => (
        <ModelAsset
          key={id}
          id={id}
          transforms={room.props.filter((p) => p.id === id)}
          fallback={
            <group>
              {room.props
                .filter((p) => p.id === id && id !== "pendant")
                .map((p, i) => (
                  <group key={i} position={p.position} rotation={p.rotation}>
                    <Box
                      decorative
                      size={
                        id === "bench"
                          ? [1.05, 0.055, 0.4]
                          : [0.42, 0.052, 0.38]
                      }
                      position={[0, id === "bench" ? 0.4 : 0.67, 0]}
                      color="#b99c76"
                    />
                    {[-1, 1].flatMap((x) =>
                      [-1, 1].map((z) => (
                        <Box
                          decorative
                          key={`${x}${z}`}
                          size={[0.028, id === "bench" ? 0.38 : 0.64, 0.028]}
                          position={[
                            x * (id === "bench" ? 0.43 : 0.16),
                            id === "bench" ? 0.19 : 0.32,
                            z * 0.13,
                          ]}
                          color="#293333"
                        />
                      )),
                    )}
                  </group>
                ))}
            </group>
          }
        />
      ))}
      {counter && (
        <group
          position={[
            counter.x / 100,
            0.1 +
              counter.height / 100 +
              countertopThickness(design, catalog, counter.wall),
            counter.z / 100,
          ]}
          rotation={[0, counter.rotation, 0]}
        >
          <ModelAsset id="counter-set" position={[0, 0, -0.08]} />
        </group>
      )}
    </group>
  );
}
