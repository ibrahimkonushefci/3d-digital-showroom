/** Cabinet rendering: carcass, fronts, drawers, interiors and fittings,
 * moved from Scene.tsx unchanged so scene composition stays readable. */
import { InteriorComponents } from "../../scene/InteriorComponents";
import { useInteriorInteraction } from "../useInteriorInteraction";
import { ovenSlot } from "../../scene/assets/placement";
import { CabinetShell } from "../../scene/CabinetShell";
import { InspectionContents } from "../../scene/InspectionContents";
import { GapShade } from "../../scene/GapShade";
import { WardrobePopulation } from "../../scene/rooms/WardrobePopulation";
import type { RenderInput } from "../../scene/renderInput";
import { useCabinetInteraction } from "../useCabinetInteraction";
import { StorageDetails } from "../../scene/StorageDetails";
import { useSceneInvalidation } from "../../scene/activity";
import { useMemo, useRef, useContext } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MathUtils } from "three";
import type { Catalog, DesignDocument, Material } from "../../catalog/types";
import { hobCabinet, wallOffset } from "../layout";
import { Hob, Hood, Sink, Oven, Fridge } from "../../scene/Appliances";
/** +1 when the room centre lies on this cabinet's local +X side: hanging
 * garments then turn their fronts that way, towards where people stand. */
const fanTowards = (
  design: DesignDocument,
  c: DesignDocument["cabinets"][number],
) => {
  const dx = design.room.width / 200 - c.x / 100,
    dz = design.room.depth / 200 - c.z / 100;
  return dx * Math.cos(c.rotation) - dz * Math.sin(c.rotation) >= 0 ? 1 : -1;
};
/** Dark fronts get the matt-black tap; light ones the chrome gooseneck. */
const isDark = (hex: string) => {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 90;
};
import { Box, PanelMapping } from "../../scene/Primitives";
import {
  construction,
  shelfDepth,
  drawerConstruction,
} from "../../scene/construction";
import { Fittings, cabinetFittings } from "../../scene/Fittings";
import { useDesigner } from "../store";
import { SelectionFrame, type FrameKind } from "./SelectionFrame";

function Handle({
  kind,
  color,
  w,
  h,
  side = 0,
}: {
  kind: string;
  color: string;
  w: number;
  h: number;
  side?: number;
}) {
  const parts = useMemo(() => {
    if (kind === "none") return [];
    if (h > 1.4) {
      const edgeX = side !== 0 ? -side * (w / 2 - 0.042) : w / 2 - 0.042,
        barLen = Math.min(0.75, h * 0.35),
        centerY = -h * 0.05;
      if (kind === "profile")
        return [
          {
            size: [0.014, h - 0.06, 0.02] as [number, number, number],
            position: [edgeX, 0, 0.016] as [number, number, number],
          },
        ];
      return [
        {
          size: [0.014, barLen, 0.018] as [number, number, number],
          position: [edgeX, centerY, 0.024] as [number, number, number],
        },
        ...[-1, 1].map((n) => ({
          size: [0.012, 0.012, 0.022] as [number, number, number],
          position: [edgeX, centerY + n * (barLen * 0.38), 0.014] as [
            number,
            number,
            number,
          ],
        })),
      ];
    }
    return [
      {
        size: [
          kind === "profile" ? w - 0.025 : Math.min(0.22, w * 0.55),
          0.014,
          0.018,
        ] as [number, number, number],
        position: [0, h / 2 - (kind === "profile" ? 0.014 : 0.06), 0.028] as [
          number,
          number,
          number,
        ],
      },
      ...(kind === "bar"
        ? [-1, 1].map((n) => ({
            size: [0.012, 0.012, 0.024] as [number, number, number],
            position: [n * Math.min(0.09, w * 0.22), h / 2 - 0.06, 0.014] as [
              number,
              number,
              number,
            ],
          }))
        : []),
    ];
  }, [kind, w, h, side]);
  return (
    <Fittings parts={parts} color={color} roughness={0.3} metalness={0.92} />
  );
}
function DoorPanel({
  w,
  h,
  side,
  front,
  handle,
  glass,
  open,
  profile,
}: {
  w: number;
  h: number;
  side: number;
  front: Material;
  handle: Catalog["handles"][number];
  glass: boolean;
  open: boolean;
  profile?: string;
}) {
  const identity = useContext(PanelMapping);
  const pivot = useRef<Group>(null);
  const invalidate = useSceneInvalidation();
  useFrame((_, dt) => {
    if (!pivot.current) return;
    const target = open ? -side * 1.35 : 0;
    const a = MathUtils.damp(pivot.current.rotation.y, target, 8, dt);
    if (Math.abs(a - target) > 0.001) {
      pivot.current.rotation.y = a;
      invalidate();
    } else {
      pivot.current.rotation.y = target;
      invalidate.settled();
    }
  });
  return (
    <PanelMapping.Provider value={{ ...identity, role: "door-" + side }}>
      <group ref={pivot} position={[(side * w) / 2, 0, 0]}>
        <group position={[(-side * w) / 2, 0, 0]}>
          {glass ? (
            <>
              <Box
                size={[w - 0.007, h - 0.007, 0.018]}
                color="#9db4b1"
                transparent
              />
              <Box
                size={[0.035, h, 0.025]}
                position={[-w / 2 + 0.015, 0, 0]}
                material={front}
                lacquer
              />
              <Box
                size={[0.035, h, 0.025]}
                position={[w / 2 - 0.015, 0, 0]}
                material={front}
                lacquer
              />
              <Box
                size={[w, 0.035, 0.025]}
                position={[0, h / 2 - 0.015, 0]}
                material={front}
                lacquer
              />
              <Box
                size={[w, 0.035, 0.025]}
                position={[0, -h / 2 + 0.015, 0]}
                material={front}
                lacquer
              />
            </>
          ) : (
            <Box
              panelRole="front"
              size={[w - 0.006, h - 0.006, 0.02]}
              material={front}
              lacquer
            />
          )}
          {profile === "panel" && !glass && (
            <>
              <Box
                size={[0.04, h - 0.06, 0.014]}
                position={[-w / 2 + 0.035, 0, 0.014]}
                material={front}
                lacquer
              />
              <Box
                size={[0.04, h - 0.06, 0.014]}
                position={[w / 2 - 0.035, 0, 0.014]}
                material={front}
                lacquer
              />
              <Box
                size={[w - 0.06, 0.04, 0.014]}
                position={[0, h / 2 - 0.035, 0.014]}
                material={front}
                lacquer
              />
              <Box
                size={[w - 0.06, 0.04, 0.014]}
                position={[0, -h / 2 + 0.035, 0.014]}
                material={front}
                lacquer
              />
            </>
          )}
          <Handle
            color={handle.color}
            kind={handle.id}
            w={w}
            h={h}
            side={side}
          />
        </group>
      </group>
    </PanelMapping.Provider>
  );
}
function Drawer({
  w,
  d,
  index,
  carcass,
  h,
  z,
  y,
  front,
  handle,
  open,
  organizer,
}: {
  w: number;
  d: number;
  index: number;
  carcass: Material;
  h: number;
  z: number;
  y: number;
  front: Material;
  handle: Catalog["handles"][number];
  open: boolean;
  organizer: boolean;
}) {
  const identity = useContext(PanelMapping);
  const body = useMemo(() => drawerConstruction(w, h, d), [w, h, d]);
  const drawerParts = useMemo(
    () => [
      ...[-1, 1].map((n) => ({
        size: [body.side, body.sideHeight, body.bodyDepth] as [
          number,
          number,
          number,
        ],
        position: [
          n * (body.outerWidth / 2 - body.side / 2),
          body.sideY,
          body.centreZ,
        ] as [number, number, number],
      })),
      {
        size: [body.outerWidth - 2 * body.side, body.sideHeight, body.side] as [
          number,
          number,
          number,
        ],
        position: [0, body.sideY, body.backZ] as [number, number, number],
      },
    ],
    [body],
  );
  const group = useRef<Group>(null);
  const invalidate = useSceneInvalidation();
  useFrame((_, dt) => {
    if (group.current) {
      const target = z + (open ? body.extension : 0),
        next = MathUtils.damp(group.current.position.z, target, 8, dt);
      group.current.position.z = next;
      if (Math.abs(next - target) > 0.001) invalidate();
      else invalidate.settled();
    }
  });
  return (
    <PanelMapping.Provider value={{ ...identity, role: "drawer-" + index }}>
      <group ref={group} position={[0, y, z]}>
        <Box
          panelRole="front"
          grain="horizontal"
          size={[w - 0.006, h - 0.006, 0.02]}
          material={front}
          lacquer
        />
        <Handle color={handle.color} kind={handle.id} w={w} h={h} />
        <InspectionContents visible={open}>
          <Box
            panelRole="bottom"
            grain="horizontal"
            size={[
              body.outerWidth - 2 * body.side,
              body.bottom,
              body.bodyDepth - body.side,
            ]}
            position={[0, body.bottomY, body.centreZ + body.side / 2]}
            material={carcass}
          />
          <Fittings color="#747e81" roughness={0.65} parts={drawerParts} />
          {organizer &&
            [-0.12, 0, 0.12]
              .filter((x) => Math.abs(x) < body.outerWidth / 2 - 0.035)
              .map((x) => (
                <Box
                  key={x}
                  size={[0.009, 0.045, body.bodyDepth - 0.055]}
                  position={[x, body.bottomY + 0.0275, body.centreZ + 0.012]}
                  color="#76684e"
                />
              ))}
        </InspectionContents>
      </group>
    </PanelMapping.Provider>
  );
}
function WardrobeDrawer({
  cabinetId,
  componentId,
  interior,
  interactive,
  ...props
}: Parameters<typeof Drawer>[0] & {
  cabinetId: string;
  componentId: string;
  interior: boolean;
  interactive: boolean;
}) {
  const opened = useDesigner((s) =>
    s.openedInterior.some(
      (i) => i.cabinetId === cabinetId && i.componentId === componentId,
    ),
  );
  const interaction = useInteriorInteraction(
    cabinetId,
    componentId,
    interactive && interior,
  );
  return (
    <group {...interaction}>
      <Drawer {...props} open={interior ? opened || props.open : props.open} />
    </group>
  );
}
export function CabinetMesh({
  furniture,
  finishes,
  design,
  catalog,
  interactive,
  inspection,
}: {
  furniture: RenderInput["furniture"]["cabinets"][number];
  finishes: RenderInput["furniture"]["style"];
  design: DesignDocument;
  catalog: Catalog;
  interactive: boolean;
  inspection?: { opened: readonly string[]; interior: boolean };
}) {
  const { cabinet: c, module: m, interior: storage } = furniture;
  const frame = useDesigner((s): FrameKind | null =>
      !interactive
        ? null
        : s.selected === c.id
          ? "selected"
          : s.highlight.includes(c.id)
            ? "suggested"
            : null,
    ),
    open = useDesigner((s) =>
      inspection
        ? inspection.opened.includes(c.id)
        : interactive && s.opened.includes(c.id),
    );
  const interior = useDesigner(
    (s) =>
      (inspection ? inspection.interior : interactive && s.interior) &&
      design.kind === "wardrobe",
  );
  const decoration = useDesigner((s) => !interactive || s.interiorDecoration);
  const interaction = useCabinetInteraction(
    c,
    catalog,
    interactive,
    !["hood", "open", "oven", "fridge"].includes(m.type),
  );
  const { front, carcass, handle, plinthAppearance, backsplashAppearance } =
    finishes;
  const carcassReveal = carcass;
  const thickness = finishes.thickness;
  const w = c.width / 100,
    h = c.height / 100,
    d = c.depth / 100;
  const fittingParts = useMemo(
    () =>
      cabinetFittings(
        w,
        h,
        d,
        m.type === "drawers"
          ? c.level === "wardrobe"
            ? storage.shelves
            : []
          : storage.shelves,
        c.interior
          ? storage.components
              .filter((p) => p.kind === "drawer" || p.kind === "basket")
              .map((p) => (p.yCm + 1.8) / 100)
          : m.type === "drawers"
            ? [0, 1, 2].map(
                (i) =>
                  (c.level === "wardrobe" ? storage.drawerHeight : h / 3) * i +
                  0.048,
              )
            : [],
        !["open", "drawers", "sliding", "pantry", "fridge", "oven"].includes(
          m.type,
        ),
      ),
    [w, h, d, storage.shelves, storage.drawerHeight, m.type, c.level],
  );
  const y = c.level === "wall" ? 1.4 : c.level === "wardrobe" ? 0 : 0.1;
  // The door above a wardrobe drawer stack meets the top drawer with the same
  // few-millimetre gap as every other front, hiding the shelf behind it.
  const drawerSlots =
    c.interior && c.level === "wardrobe"
      ? storage.components
          .filter((p) => p.kind === "drawer")
          .map((p) => p.yCm / 22)
      : [0, 1, 2];
  const doorBottom =
    c.level === "wardrobe"
      ? storage.drawerHeight * (Math.max(-1, ...drawerSlots) + 1) + 0.004
      : 0.68;
  const sliding = useRef<Group>(null),
    pantryFront = useRef<Group>(null);
  const invalidate = useSceneInvalidation();
  useFrame((_, dt) => {
    let moving = false;
    if (pantryFront.current) {
      const target = open ? 0.38 : 0;
      pantryFront.current.position.z = MathUtils.damp(
        pantryFront.current.position.z,
        target,
        7,
        dt,
      );
      if (Math.abs(pantryFront.current.position.z - target) > 0.001)
        moving = true;
    }
    if (sliding.current) {
      const target = open ? w * 0.4 : 0;
      sliding.current.position.x = MathUtils.damp(
        sliding.current.position.x,
        target,
        8,
        dt,
      );
      if (Math.abs(sliding.current.position.x - target) > 0.001) moving = true;
    }
    if (moving) invalidate();
    else invalidate.settled();
  });
  if (m.type === "hood")
    return (
      <group
        position={[c.x / 100, 1.4, c.z / 100]}
        rotation={[0, c.rotation, 0]}
        {...interaction}
      >
        <group position={[0, 0, 0.125]}>
          <Hood width={w} />
        </group>
        {frame && (
          <SelectionFrame
            kind={frame}
            w={w}
            y0={0}
            y1={h}
            z0={0.125 - d / 2}
            z1={0.125 + d / 2 + 0.02}
          />
        )}
      </group>
    );
  return (
    <PanelMapping.Provider value={{ cabinetId: c.id, role: "carcass" }}>
      <group
        position={[c.x / 100, y, c.z / 100]}
        rotation={[0, c.rotation, 0]}
        {...interaction}
      >
        {frame && (
          <SelectionFrame
            kind={frame}
            w={w}
            y0={c.level === "base" ? -y : 0}
            y1={h + (c.level === "base" ? thickness : 0) + 0.004}
            z0={-d / 2 - 0.004}
            z1={d / 2 + 0.04}
          />
        )}
        {/* Fridge housings keep an open niche above the appliance. */}
        {!["open", "glass", "fridge"].includes(m.type) && (
          <GapShade w={w} h={h} d={d} closed={!open && !interior} />
        )}
        <CabinetShell
          w={w}
          h={h}
          d={d}
          sink={m.type === "sink"}
          material={carcassReveal}
          cabinetId={c.id}
          shelves={
            (m.type === "drawers" && c.level !== "wardrobe") ||
            ["sink", "pantry", "corner"].includes(m.type)
              ? []
              : storage.shelves
          }
        />
        <InspectionContents
          visible={open || interior || m.type === "open" || m.type === "glass"}
        >
          {c.level === "wardrobe" ? (
            <InteriorComponents
              c={c}
              components={storage.components.filter(
                (p) => m.type !== "drawers" || p.kind !== "drawer",
              )}
              carcass={carcass}
              interactive={interactive}
              interior={interior}
            />
          ) : m.type === "hanging" || m.type === "sliding" ? (
            <>
              <mesh
                position={[0, storage.rail ?? h - 0.32, 0]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.008, 0.008, w - 0.05, 12]} />
                <meshStandardMaterial
                  color="#aaa"
                  metalness={0.8}
                  roughness={0.2}
                />
              </mesh>
              {[-1, 1].map((side) => (
                <mesh
                  key={side}
                  position={[
                    side * (w / 2 - 0.027),
                    storage.rail ?? h - 0.32,
                    0,
                  ]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.021, 0.021, 0.016, 16]} />
                  <meshStandardMaterial
                    color="#adb5b4"
                    metalness={0.85}
                    roughness={0.25}
                  />
                </mesh>
              ))}
            </>
          ) : (
            m.type !== "drawers" &&
            m.type !== "sink" &&
            m.type !== "pantry" &&
            m.type !== "corner" &&
            storage.shelves.map((r) => (
              <Box
                key={r}
                bevel={0.0015}
                grain="horizontal"
                panelRole={"shelf-" + r}
                size={[w - 0.036, 0.018, shelfDepth(d)]}
                position={[0, r, construction.shelfCentreZ]}
                material={carcass}
                cavity={{
                  size: [w, h, d],
                  shelves: storage.shelves,
                  offset: [0, r, construction.shelfCentreZ],
                }}
              />
            ))
          )}
          {/* Mounted while closed too (the group hides them), so clothes and
              fittings are loaded and their shaders compiled with the design,
              not in the middle of the door animation. */}
          <Fittings parts={fittingParts} />
          {decoration &&
            design.kind === "wardrobe" &&
            design.cabinets.length < 24 && (
              <WardrobePopulation
                cabinet={c}
                module={m}
                storage={storage}
                fan={fanTowards(design, c)}
              />
            )}
          <StorageDetails kind={m.type} w={w} h={h} d={d} open={open} />
        </InspectionContents>
        {m.type === "pantry" ? (
          <group position={[0, h / 2, d / 2 + 0.012]}>
            <group ref={pantryFront}>
              <Box
                size={[w - 0.006, h - 0.006, 0.02]}
                material={front}
                lacquer
              />
              <Handle color={handle.color} kind={handle.id} w={w} h={h} />
            </group>
          </group>
        ) : m.type === "drawers" ? (
          (c.interior && c.level === "wardrobe"
            ? storage.components
                .filter((p) => p.kind === "drawer")
                .map((p) => p.yCm / 22)
            : [0, 1, 2]
          ).map((i) => (
            <WardrobeDrawer
              cabinetId={c.id}
              componentId={
                storage.components.find(
                  (p) =>
                    p.kind === "drawer" && Math.abs(p.yCm - i * 22) < 0.001,
                )?.id ?? `${c.id}:drawer:${i}`
              }
              interior={c.level === "wardrobe" && interior}
              interactive={interactive && c.level === "wardrobe"}
              key={i}
              w={w}
              d={d}
              index={i}
              carcass={carcass}
              h={c.level === "wardrobe" ? storage.drawerHeight : h / 3}
              y={
                c.level === "wardrobe"
                  ? storage.drawerHeight * (i + 0.5)
                  : (h * (i + 0.5)) / 3
              }
              z={d / 2 + 0.012}
              front={front}
              handle={handle}
              open={open}
              organizer={i === 0}
            />
          ))
        ) : interior ? null : m.type === "sliding" ? (
          <group position={[0, h / 2, d / 2 + 0.012]}>
            {[-1, 1].map((side) => (
              <Box
                key={side}
                size={[w - 0.025, 0.018, 0.065]}
                position={[0, side * (h / 2 - 0.018), 0]}
                color="#4a4540"
                metal={0.75}
                roughness={0.32}
              />
            ))}
            <group ref={sliding}>
              <Box
                size={[0.014, 0.28, 0.014]}
                position={[-0.025, 0, 0.034]}
                color="#1a1c20"
                metal={0.92}
                roughness={0.25}
              />
              <Box
                size={[w / 2 + 0.016, h - 0.008, 0.025]}
                position={[-w / 4, 0, 0.016]}
                material={front}
                lacquer
              />
              <Box
                size={[0.02, h - 0.01, 0.03]}
                position={[-0.004, 0, 0.016]}
                color="#4a4540"
                metal={0.75}
                roughness={0.32}
              />
            </group>
            <Box
              size={[w / 2 + 0.016, h - 0.008, 0.025]}
              position={[w / 4, 0, -0.02]}
              material={front}
              lacquer
            />
            <Box
              size={[0.02, h - 0.01, 0.03]}
              position={[0.004, 0, -0.02]}
              color="#4a4540"
              metal={0.75}
              roughness={0.32}
            />
          </group>
        ) : m.type !== "open" && m.type !== "oven" && m.type !== "fridge" ? (
          <group position={[0, h / 2, d / 2 + 0.012]}>
            {w > 0.55 ? (
              [-1, 1].map((side) => (
                <group key={side} position={[(side * w) / 4, 0, 0]}>
                  <DoorPanel
                    profile={finishes.profile}
                    w={w / 2}
                    h={h}
                    side={side}
                    front={front}
                    handle={handle}
                    open={open}
                    glass={m.type === "glass"}
                  />
                </group>
              ))
            ) : (
              <DoorPanel
                profile={finishes.profile}
                w={w}
                h={h}
                side={-1}
                front={front}
                handle={handle}
                open={open}
                glass={m.type === "glass"}
              />
            )}
          </group>
        ) : m.type === "oven" ? (
          h < 1.3 ? (
            <group position={[0, h / 2, d / 2 + 0.012]}>
              <DoorPanel
                profile={finishes.profile}
                w={w}
                h={h}
                side={-1}
                front={front}
                handle={handle}
                open={open}
                glass={false}
              />
            </group>
          ) : (
            <>
              <group position={[0, ovenSlot(h).upperCentre, d / 2 + 0.012]}>
                <DoorPanel
                  profile={finishes.profile}
                  w={w}
                  h={ovenSlot(h).upperHeight}
                  side={-1}
                  front={front}
                  handle={handle}
                  open={open}
                  glass={false}
                />
              </group>
              <group position={[0, ovenSlot(h).centre, d / 2 + 0.012]}>
                <Oven width={w} />
              </group>
              <Box
                size={[w - 0.007, 0.62, 0.022]}
                position={[0, 0.32, d / 2 + 0.012]}
                material={front}
                lacquer
              />
            </>
          )
        ) : null}
        {c.level === "wardrobe" && m.type === "drawers" && (
          <>
            {!interior && (
              <group position={[0, (h + doorBottom) / 2, d / 2 + 0.012]}>
                <DoorPanel
                  profile={finishes.profile}
                  w={w}
                  h={h - doorBottom}
                  side={-1}
                  front={front}
                  handle={handle}
                  open={open}
                  glass={false}
                />
              </group>
            )}
          </>
        )}
        {c.level === "base" && (
          <>
            {m.type === "sink" && (
              <group position={[0, h + thickness + 0.005, 0.025]}>
                <Sink width={w} dark={isDark(front.color)} />
              </group>
            )}
            {hobCabinet(design, catalog)?.id === c.id && (
              <>
                <group position={[0, h + thickness + 0.012, 0.01]}>
                  <Hob width={w} />
                </group>
                {!design.cabinets.some(
                  (n) =>
                    n.moduleId === "wall-hood" &&
                    n.wall === c.wall &&
                    Math.abs(wallOffset(n) - wallOffset(c)) < 1,
                ) && (
                  <group position={[0, 1.47, 0.02]}>
                    <Hood width={w} builtIn />
                  </group>
                )}
              </>
            )}
          </>
        )}
        {m.type === "dishwasher" && (
          <Box
            size={[w - 0.04, 0.04, 0.024]}
            position={[0, h - 0.025, d / 2 + 0.02]}
            color="#474d4f"
            metal={0.7}
          />
        )}
        {m.type === "fridge" && (
          <group position={[0, 0, d / 2 + 0.012]}>
            <Fridge width={w} height={h} />
          </group>
        )}
        {c.level === "wardrobe" && design.environment?.internalLed && (
          <>
            <Box
              size={[w - 0.07, 0.008, 0.016]}
              position={[0, h - 0.045, d / 2 - 0.045]}
              color="#fff0ce"
              emissive="#ffda9b"
            />
          </>
        )}
        {c.level === "wardrobe" && (
          <Box
            size={[w, 0.05, d - 0.05]}
            position={[0, -0.025, -0.025]}
            panelRole="plinth"
            material={
              finishes.plinth.mapping || finishes.plinth.matches
                ? plinthAppearance
                : undefined
            }
            color="#202227"
            roughness={0.5}
            metal={0.2}
          />
        )}
        {c.level !== "wall" && c.level !== "wardrobe" && (
          <Box
            size={[w, 0.1, d - 0.06]}
            position={[0, -0.05, -0.03]}
            panelRole="plinth"
            material={
              finishes.plinth.mapping || finishes.plinth.matches
                ? plinthAppearance
                : undefined
            }
            color="#202227"
            roughness={0.5}
            metal={0.2}
          />
        )}
        {c.level === "wall" && design.style.led && (
          <Box
            size={[w - 0.04, 0.005, 0.015]}
            position={[0, -0.006, d / 2 - 0.025]}
            color="#fff0c9"
            emissive="#ffd29a"
          />
        )}
        {design.style.backsplash !== "none" &&
          c.level === "base" &&
          c.wall !== "island" && (
            <Box
              size={[w, 0.5, 0.018]}
              position={[0, h + thickness + 0.252, -d / 2 - 0.01]}
              panelRole="backsplash"
              material={backsplashAppearance}
            />
          )}
      </group>
    </PanelMapping.Provider>
  );
}
