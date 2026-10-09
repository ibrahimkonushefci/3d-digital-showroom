import {
  Rendering,
  RefreshShadows,
  showroomGL,
  type RegisterCapture,
} from "../scene/Rendering";
import { useQuality } from "../scene/quality";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { CameraControls, Environment, Lightformer } from "@react-three/drei";
import {
  BoxGeometry,
  Mesh,
  Color,
  Group,
  MathUtils,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import type { Catalog } from "../catalog/types";
import type { InteriorDesign, InteriorDoor } from "./types";
import { Box } from "../scene/Primitives";
import { createProduct, disposeProduct } from "../scene/products";
import { PlacementSchema } from "../doorPreview/types";
import { useBrand } from "../brand";
import { useDesigner } from "../designer3d/store";
function Floor({
  design,
  catalog,
}: {
  design: InteriorDesign;
  catalog: Catalog;
}) {
  const f = catalog.laminates.find((f) => f.id === design.laminateId)!,
    { assetUrl } = useBrand(),
    performance = useQuality() === "lightweight",
    { invalidate } = useThree();
  const material = useMemo(() => {
    const loader = new TextureLoader(),
      map = loader.load(assetUrl(f.texture!), () => invalidate());
    map.colorSpace = SRGBColorSpace;
    map.wrapS = map.wrapT = RepeatWrapping;
    const normal = !performance
        ? loader.load(assetUrl(f.normalMap!), () => invalidate())
        : null,
      rough = loader.load(assetUrl(f.roughnessMap!), () => invalidate());
    if (normal) normal.wrapS = normal.wrapT = RepeatWrapping;
    rough.wrapS = rough.wrapT = RepeatWrapping;
    const m = new MeshStandardMaterial({
      map,
      normalMap: normal,
      roughnessMap: rough,
      roughness: 0.8,
      color: new Color("#ffffff"),
    });
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 floorPoint;",
        )
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nfloorPoint=(modelMatrix*vec4(transformed,1.)).xyz;",
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 floorPoint;",
        )
        .replace(
          "#include <map_fragment>",
          `
  vec2 p=floorPoint.xz;${design.direction ? "p=p.yx;" : ""}
  ${design.pattern === "diagonal" ? "p=mat2(.707,-.707,.707,.707)*p;" : ""}
  float pw=${(f.plankWidth / 100).toFixed(4)},pl=${(f.plankLength / 100).toFixed(4)};
  vec2 cell,part;
  ${
    design.pattern === "herringbone"
      ? `
  p=mat2(.707,-.707,.707,.707)*p;
  float n=floor(pl/pw+.5);pw=pl/n;
  vec2 q=p/pw,grid=floor(q);float band=mod(grid.x+grid.y,2.*n);
  if(band<n){cell=vec2(grid.x-band,grid.y);part=vec2((q.x-cell.x)/n,fract(q.y));}
  else {cell=vec2(grid.x,grid.y-(band-n));part=vec2((q.y-cell.y)/n,fract(q.x));}
  `
      : `float r=floor(p.y/pw);p.x+=mod(r,2.)*pl*.5;cell=floor(p/vec2(pl,pw));part=fract(p/vec2(pl,pw));`
  }
  float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
  vec2 grain=vec2(part.x,part.y*.22)+vec2(seed,seed*.5);
  vec4 sampledDiffuseColor=texture2D(map,grain);sampledDiffuseColor.rgb*=.88+seed*.22;
  float edge=min(min(part.x,1.-part.x)*pl,min(part.y,1.-part.y)*pw);
  sampledDiffuseColor.rgb*= ${f.groove ? "mix(.52,1.,smoothstep(0.,.0018,edge))" : "1."};
  diffuseColor*=sampledDiffuseColor;`,
        );
    };
    return m;
  }, [f, assetUrl, performance, design.pattern, design.direction, invalidate]);
  useEffect(
    () => () => {
      material.map?.dispose();
      material.normalMap?.dispose();
      material.roughnessMap?.dispose();
      material.dispose();
    },
    [material],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={material}>
      <planeGeometry
        args={[design.room.width / 100, design.room.depth / 100]}
      />
    </mesh>
  );
}
function Door({
  door,
  catalog,
  selected,
  open,
  onClick,
}: {
  door: InteriorDoor;
  catalog: Catalog;
  selected: boolean;
  open: boolean;
  onClick: () => void;
}) {
  const { assetUrl } = useBrand(),
    performance = useQuality() === "lightweight",
    { invalidate } = useThree(),
    model = catalog.interiorDoors.find((m) => m.id === door.modelId)!,
    finish = catalog.productFinishes.find((f) => f.id === door.finishId)!;
  const object = useMemo(() => {
    const styles = {
        flat: 0,
        grooves: 1,
        glass: 6,
        classic: 3,
        invisible: 0,
        barn: 1,
        pocket: 0,
      },
      p = PlacementSchema.parse({
        id: door.id,
        kind: "door",
        modelId: "interior",
        width: door.width + 10.5,
        height: 210,
        color: finish.color,
        finishId: finish.id,
        corners: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        handle: "bar",
        brightness: 1,
        options: model.style === "glass" ? ["satin"] : [],
      });
    const g = createProduct(
        p,
        {
          ...catalog,
          doors: [
            { ...catalog.doors[0], id: "interior", style: styles[model.style] },
          ],
        },
        assetUrl,
        performance,
      ),
      leaf = g.getObjectByName("leaf")!;
    const w = door.width / 100,
      side = door.opening === "left" ? -1 : 1;
    leaf.children.forEach((o) => (o.position.x -= (side * w) / 2));
    leaf.position.x = (side * w) / 2;
    if (model.style === "invisible") {
      g.getObjectByName("frame")!.visible = false;
      leaf.scale.y = 2.095 / 2.015;
      leaf.position.y = 0.004 - 0.0425 * leaf.scale.y;
    }
    if (model.style === "pocket") leaf.position.z = -0.065;
    if (
      door.hiddenHinges ||
      ["invisible", "barn", "pocket"].includes(model.style)
    )
      leaf.children
        .filter(
          (o) =>
            o.type === "Mesh" &&
            (o as import("three").Mesh).geometry.type === "CylinderGeometry",
        )
        .forEach((o) => (o.visible = false));
    const h = catalog.interiorHandles.find((h) => h.id === door.handleId)!;
    // Interior lever replaces the entrance pull bar, retaining shared frame/leaf primitives.
    leaf.children
      .filter(
        (o) =>
          o.type === "Mesh" &&
          (Math.abs(o.position.z - 0.11) < 0.001 ||
            Math.abs(o.position.z - 0.08) < 0.001),
      )
      .forEach((o) => (o.visible = false));
    const handleMaterial = new MeshStandardMaterial({
      color: h.color,
      metalness: 0.8,
      roughness: 0.25,
    });
    const lever = new Mesh(new BoxGeometry(0.12, 0.018, 0.025), handleMaterial);
    lever.position.set(
      (door.opening === "left" ? w * 0.3 : -w * 0.3) - (side * w) / 2,
      1.03,
      model.style === "pocket" ? 0.055 : 0.095,
    );
    leaf.add(lever);
    return g;
  }, [door, catalog, assetUrl, performance, model, finish]);
  useEffect(() => {
    const timer = setTimeout(invalidate, 400);
    return () => {
      clearTimeout(timer);
      disposeProduct(object);
    };
  }, [object, invalidate]);
  useFrame((_, dt) => {
    const leaf = object.getObjectByName("leaf")!,
      sliding = ["barn", "pocket"].includes(model.style),
      side = door.opening === "left" ? -1 : 1,
      target = open ? 1.3 * side : 0;
    if (sliding) {
      const x =
        (side * door.width) / 200 + (open ? (door.width / 100) * side : 0);
      leaf.position.x = MathUtils.damp(leaf.position.x, x, 8, dt);
      if (Math.abs(leaf.position.x - x) > 0.001) invalidate();
    } else {
      leaf.rotation.y = MathUtils.damp(leaf.rotation.y, target, 7, dt);
      if (Math.abs(leaf.rotation.y - target) > 0.001) invalidate();
    }
  });
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <primitive object={object} />
      {selected && (
        <group userData={{ exportHidden: true }}>
          <Box
            size={[door.width / 100, 0.012, 0.024]}
            position={[0, 0.012, 0.1]}
            color="#b89c62"
          />
        </group>
      )}
      {model.style === "barn" && (
        <Box
          size={[(door.width / 100) * 2, 0.025, 0.025]}
          position={[
            ((door.opening === "left" ? -1 : 1) * door.width) / 200,
            2.2,
            0.1,
          ]}
          color="#343c3f"
        />
      )}
    </group>
  );
}
function Walls({
  design,
  catalog,
  selected,
  opened,
  onDoor,
}: {
  design: InteriorDesign;
  catalog: Catalog;
  selected: string | null;
  opened: string[];
  onDoor: (id: string) => void;
}) {
  const w = design.room.width / 100,
    d = design.room.depth / 100,
    h = design.room.height / 100;
  return (
    <>
      {(["back", "left", "right", "front"] as const).map((side) => (
        <Wall
          key={side}
          side={side}
          design={design}
          catalog={catalog}
          selected={selected}
          opened={opened}
          onDoor={onDoor}
          w={w}
          d={d}
          h={h}
        />
      ))}
    </>
  );
}
function Wall({
  side,
  design,
  catalog,
  selected,
  opened,
  onDoor,
  w,
  d,
  h,
}: {
  side: "back" | "left" | "right" | "front";
  design: InteriorDesign;
  catalog: Catalog;
  selected: string | null;
  opened: string[];
  onDoor: (id: string) => void;
  w: number;
  d: number;
  h: number;
}) {
  const ref = useRef<Group>(null),
    length = ["left", "right"].includes(side) ? d : w,
    doors = design.doors
      .filter((p) => p.wall === side)
      .sort((a, b) => a.offset - b.offset),
    pos: [number, number, number] =
      side === "back"
        ? [0, 0, -d / 2]
        : side === "front"
          ? [0, 0, d / 2]
          : side === "left"
            ? [-w / 2, 0, 0]
            : [w / 2, 0, 0],
    rotation =
      side === "back"
        ? 0
        : side === "front"
          ? Math.PI
          : side === "left"
            ? Math.PI / 2
            : -Math.PI / 2;
  useFrame(({ camera }) => {
    if (ref.current)
      ref.current.visible =
        side === "front"
          ? camera.position.z < d / 2
          : side === "back"
            ? camera.position.z > -d / 2
            : side === "left"
              ? camera.position.x > -w / 2
              : camera.position.x < w / 2;
  });
  const spans: Array<[number, number]> = [];
  let start = 0;
  doors.forEach((p) => {
    const margin =
      catalog.interiorDoors.find((m) => m.id === p.modelId)!.style ===
      "invisible"
        ? 0
        : 0.04;
    const a = Math.max(0, p.offset / 100 - margin);
    if (a > start) spans.push([start, a]);
    start = (p.offset + p.width) / 100 + margin;
  });
  if (start < length) spans.push([start, length]);
  const skirt = catalog.skirtings.find((s) => s.id === design.skirtingId)!,
    floor = catalog.laminates.find((f) => f.id === design.laminateId)!,
    doorFinish = catalog.productFinishes.find(
      (f) => f.id === design.doors[0]?.finishId,
    ),
    skirtColor =
      skirt.mode === "white"
        ? "#f7f5ee"
        : skirt.mode === "floor"
          ? floor.color
          : doorFinish?.color;
  return (
    <group ref={ref} position={pos} rotation={[0, rotation, 0]}>
      {spans.map(([a, b]) => (
        <group key={a}>
          <Box
            size={[b - a, h, 0.1]}
            position={[(a + b) / 2 - length / 2, h / 2, -0.055]}
            color="#ebe7df"
          />
          <Box
            size={[b - a, design.skirtingHeight / 100, 0.012]}
            position={[
              (a + b) / 2 - length / 2,
              design.skirtingHeight / 200,
              0.008,
            ]}
            color={skirtColor}
          />
        </group>
      ))}
      {doors.map((p) => (
        <group
          key={p.id}
          position={[(p.offset + p.width / 2) / 100 - length / 2, 0, 0]}
        >
          <Box
            size={[
              p.width / 100 +
                (catalog.interiorDoors.find((m) => m.id === p.modelId)!
                  .style === "invisible"
                  ? 0
                  : 0.08),
              h - 2.12,
              0.1,
            ]}
            position={[0, (h + 2.12) / 2, -0.055]}
            color="#ebe7df"
          />
          <Door
            door={p}
            catalog={catalog}
            selected={selected === p.id}
            open={opened.includes(p.id)}
            onClick={() => onDoor(p.id)}
          />
        </group>
      ))}
    </group>
  );
}
function Camera({
  design,
  preset,
  move,
  capture,
}: {
  design: InteriorDesign;
  preset: string;
  move: number;
  capture?: RegisterCapture;
}) {
  const ref = useRef<CameraControls>(null),
    { gl, camera, scene, invalidate } = useThree(),
    lastMove = useRef(move);
  useEffect(() => {
    if (preset === "walkthrough") {
      camera.position.set(0, 1.6, design.room.depth / 200 - 0.25);
      camera.rotation.order = "YXZ";
      camera.rotation.set(0, 0, 0);
      invalidate();
    } else {
      const span = Math.max(design.room.width, design.room.depth) / 100;
      ref.current?.setLookAt(
        preset === "top" ? 0 : span * 0.65,
        preset === "top" ? span * 1.7 : span * 0.8,
        preset === "top" ? 0.01 : span * 0.9,
        0,
        1,
        0,
        true,
      );
    }
  }, [preset, design.room.width, design.room.depth, camera, invalidate]);
  useEffect(() => {
    if (preset !== "walkthrough") return;
    const amount = (move - lastMove.current) * 0.35;
    lastMove.current = move;
    camera.position.x = Math.max(
      -design.room.width / 200 + 0.15,
      Math.min(
        design.room.width / 200 - 0.15,
        camera.position.x - Math.sin(camera.rotation.y) * amount,
      ),
    );
    camera.position.z = Math.max(
      -design.room.depth / 200 + 0.15,
      Math.min(
        design.room.depth / 200 - 0.15,
        camera.position.z - Math.cos(camera.rotation.y) * amount,
      ),
    );
    invalidate();
  }, [move, preset, camera, design.room.width, design.room.depth, invalidate]);
  useEffect(() => {
    if (preset !== "walkthrough") return;
    const el = gl.domElement;
    let point: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      point = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const up = () => {
      point = null;
    };
    const drag = (e: PointerEvent) => {
      if (!point) return;
      camera.rotation.y -= (e.clientX - point.x) * 0.004;
      camera.rotation.x = Math.max(
        -0.65,
        Math.min(0.65, camera.rotation.x - (e.clientY - point.y) * 0.004),
      );
      point = { x: e.clientX, y: e.clientY };
      invalidate();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", drag);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", drag);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [preset, gl, camera, invalidate]);

  return preset === "walkthrough" ? null : (
    <CameraControls
      ref={ref}
      minDistance={1}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2 - 0.015}
    />
  );
}
export default function InteriorScene({
  design,
  catalog,
  selected,
  opened,
  onDoor,
  preset,
  move,
  capture,
}: {
  design: InteriorDesign;
  catalog: Catalog;
  selected: string | null;
  opened: string[];
  onDoor: (id: string) => void;
  preset: string;
  move: number;
  capture?: RegisterCapture;
}) {
  const performance = useQuality() === "lightweight",
    h = design.room.height / 100,
    w = design.room.width / 100,
    d = design.room.depth / 100;
  return (
    <Canvas
      frameloop="demand"
      shadows={!performance}
      dpr={performance ? 1 : [1, 1.5]}
      camera={{ position: [5, 5, 7], fov: 50 }}
      gl={showroomGL}
    >
      <color attach="background" args={["#e8e7df"]} />
      <ambientLight intensity={design.evening ? 0.2 : 0.35} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={design.evening ? 0.3 : 2}
        castShadow={!performance}
        shadow-mapSize={1024}
      />
      <Environment frames={1} resolution={64}>
        <Lightformer intensity={2} position={[0, 6, 1]} scale={[10, 10, 1]} />
      </Environment>
      <Floor design={design} catalog={catalog} />
      <Walls
        design={design}
        catalog={catalog}
        selected={selected}
        opened={opened}
        onDoor={onDoor}
      />
      {[0.2, 0.5, 0.8].map((n) => (
        <group key={n} position={[0, h - 0.025, (n - 0.5) * d]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.015, 16]} />
            <meshStandardMaterial
              color="#fff4ce"
              emissive="#ffdca0"
              emissiveIntensity={1}
            />
          </mesh>
          <pointLight
            color="#ffddaa"
            intensity={design.evening ? 0.55 : 0.12}
            distance={3}
          />
        </group>
      ))}
      <Box
        size={[w, 0.025, 0.14]}
        position={[0, h, -d / 2 + 0.07]}
        color="#faf8f0"
      />
      {design.preset !== "hallway" && (
        <group
          position={[w / 2 - 0.02, 1.7, 0]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <Box size={[1.3, 1.2, 0.02]} color="#c2dce7" />
          <Box size={[0.05, 1.3, 0.08]} color="#faf9f2" />
          <Box
            size={[1.4, 0.06, 0.16]}
            position={[0, -0.65, 0]}
            color="#f9f8f1"
          />
        </group>
      )}
      {design.furniture &&
        (design.preset === "hallway" ? (
          <>
            <Box
              size={[0.32, 0.7, 1.1]}
              position={[w / 2 - 0.21, 0.35, -0.3]}
              color="#bdb2a0"
            />
            <Box
              size={[0.02, 1.1, 0.65]}
              position={[-w / 2 + 0.07, 1.35, 0]}
              color="#c4d1d2"
              metal={0.7}
            />
          </>
        ) : design.preset === "living" ? (
          <>
            <Box
              size={[2, 0.45, 0.8]}
              position={[0, 0.32, -d / 2 + 0.65]}
              color="#a9ada7"
            />
            <Box
              size={[2, 0.48, 0.15]}
              position={[0, 0.73, -d / 2 + 0.25]}
              color="#a9ada7"
            />
            <Box
              size={[1, 0.06, 0.55]}
              position={[0, 0.42, 0]}
              color="#bbaa90"
            />
          </>
        ) : (
          <>
            <Box
              size={[1.6, 0.42, 2]}
              position={[0, 0.26, -d / 2 + 1.3]}
              color="#b4aea2"
            />
            <Box
              size={[1.6, 0.18, 1.9]}
              position={[0, 0.55, -d / 2 + 1.3]}
              color="#efeee5"
            />
            <Box
              size={[1.6, 0.8, 0.06]}
              position={[0, 0.6, -d / 2 + 0.25]}
              color="#a3a498"
            />
          </>
        ))}
      <Camera design={design} preset={preset} move={move} />
      <Rendering capture={capture} />
    </Canvas>
  );
}
