import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { insideWall } from "./RoomShell";
import type { RoomBox } from "./stance";
import type { Catalog, DesignDocument } from "../../catalog/types";
import { resolveRoom } from "./resolveRoom";
import { ModelAsset } from "../assets/ModelAsset";
import { Box } from "../Primitives";
import { countertopThickness } from "../furnitureMaterials";
import { worktopDecor, type DecorItem } from "./decor";
import { roomStaging } from "./staging";
import { StagingPiece } from "./StagingPieces";
/** Decor hanging on a wall disappears with that wall when it is cut away
 * (overview, or the hero stance behind it), instead of floating. */
function OnWall({
  room,
  wall,
  children,
}: {
  room: RoomBox;
  wall?: DecorItem["wall"];
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (group.current && wall)
      group.current.visible = insideWall(camera, room, wall);
  });
  return <group ref={group}>{children}</group>;
}
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
  const decor = useMemo(() => {
    if (!room.furnished) return [];
    const items: DecorItem[] = worktopDecor(
      design,
      catalog,
      counter ? [counter.id] : [],
    );
    return items;
  }, [design, catalog, room, counter]);
  const staging = useMemo(
    () =>
      room.furnished
        ? roomStaging(design, catalog)
        : { models: [], built: [], solids: [] },
    [design, catalog, room],
  );
  // Staged models grouped by id and wall: one instanced draw per group.
  const stagedGroups = useMemo(() => {
    const groups = new Map<string, typeof staging.models>();
    for (const m of staging.models) {
      const key = m.id + "|" + (m.wall ?? "");
      groups.set(key, [...(groups.get(key) ?? []), m]);
    }
    return [...groups.entries()];
  }, [staging]);
  return (
    <group userData={{ reflectionStatic: true }}>
      {[...new Set(decor.map((d) => d.id))].map((id) => {
        const items = decor.filter((d) => d.id === id);
        return (
          <OnWall key={"decor-" + id} room={room.envelope.room} wall={items[0].wall}>
            <ModelAsset id={id} transforms={items} />
          </OnWall>
        );
      })}
      {stagedGroups.map(([key, items]) => (
        <OnWall key={"staged-" + key} room={room.envelope.room} wall={items[0].wall}>
          <ModelAsset
            id={items[0].id}
            transforms={items}
            castShadow={items[0].id !== "pendant-globe" && !items[0].wall}
            glow={
              items[0].id === "pendant-globe"
                ? "modern_ceiling_globe"
                : undefined
            }
          />
        </OnWall>
      ))}
      {staging.built.map((piece, i) => (
        <OnWall
          key={"built-" + piece.type + i}
          room={room.envelope.room}
          wall={"wall" in piece ? piece.wall : undefined}
        >
          <StagingPiece piece={piece} />
        </OnWall>
      ))}
      {[...new Set(room.props.map((p) => p.id))].map((id) => (
        <ModelAsset
          key={id}
          id={id}
          castShadow={id !== "pendant"}
          glow={id === "pendant" ? "diffuser" : undefined}
          transforms={room.props.filter((p) => p.id === id)}
          fallback={
            <group>
              {room.props
                .filter((p) => p.id === id && id !== "pendant")
                .map((p, i) => (
                  <group key={i} position={p.position} rotation={p.rotation}>
                    <Box
                      decorative
                      size={[0.42, 0.052, 0.38]}
                      position={[0, 0.67, 0]}
                      color="#b99c76"
                    />
                    {[-1, 1].flatMap((x) =>
                      [-1, 1].map((z) => (
                        <Box
                          decorative
                          key={`${x}${z}`}
                          size={[0.028, 0.64, 0.028]}
                          position={[x * 0.16, 0.32, z * 0.13]}
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
