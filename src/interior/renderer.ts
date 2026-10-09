import {
  homography,
  inverse,
  transform as projectPoint,
  type Corners,
} from "../doorPreview/homography";
import type { Catalog } from "../catalog/types";
import type { InteriorDesign } from "./types";
import type { InteriorPhoto, PhotoView } from "./scenes";
const vertex = `attribute vec2 position; varying vec2 screen; void main(){screen=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 screen;
uniform sampler2D photo, grain, mask, lightMap, hardware;
uniform mat3 transform, innerTransform;
uniform vec3 tint, hardwareColor;
uniform vec2 pan, meters, plank, handleAnchor, hardwareSize;
uniform float zoom, layer, pattern, direction, grooves, wood, style, shade, handleSide, hiddenHinges;
vec2 project(mat3 m,vec2 p){vec3 q=m*vec3(p,1.);return q.xy/q.z;}
float inside(vec2 uv){return step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 p=(vec2(screen.x,1.-screen.y)-.5)/zoom+.5+pan;
 vec4 original=texture2D(photo,p);
 if(layer<.5){gl_FragColor=original;return;}
 if(layer>4.5){vec2 huv=(p-handleAnchor)/hardwareSize+.5;if(handleSide<.5)huv.x=1.-huv.x;if(inside(huv)<.5)discard;vec4 h=texture2D(hardware,huv);vec3 metal=h.rgb;if(hardwareColor.r<.3)metal=vec3(.025)+metal*.18;else if(hardwareColor.r>hardwareColor.b*1.3)metal*=hardwareColor/vec3(.7);gl_FragColor=vec4(metal,h.a);return;}
 if(layer>3.5){float a=texture2D(mask,p).g;if(a<.005)discard;vec3 rgb=tint;if(wood>.5)rgb=texture2D(grain,vec2(p.x*2.,p.y*.12)).rgb;float lum=dot(original.rgb,vec3(.299,.587,.114));gl_FragColor=vec4(rgb*clamp(lum/.82,.5,1.1),a);return;}
 vec2 uv=project(transform,p);
 if(layer<1.5){
  float alpha=texture2D(mask,p).r;if(alpha<.005)discard;
  vec2 pos=uv*meters; if(direction>.5)pos=pos.yx;
  if(pattern>.5)pos=mat2(.7071,-.7071,.7071,.7071)*pos;
  vec2 cell,part;
  if(pattern>1.5){float n=floor(plank.x/plank.y+.5);vec2 q=pos/plank.y,grid=floor(q);float band=mod(grid.x+grid.y,2.*n);
   if(band<n){cell=vec2(grid.x-band,grid.y);part=vec2((q.x-cell.x)/n,fract(q.y));}else{cell=vec2(grid.x,grid.y-(band-n));part=vec2((q.y-cell.y)/n,fract(q.x));}}
  else{float row=floor(pos.y/plank.y);pos.x+=mod(row,3.)*plank.x*.33;cell=floor(pos/plank);part=fract(pos/plank);}
  float seed=hash(cell);vec3 rgb=texture2D(grain,vec2(part.x*.8+seed*.2,part.y*.16+seed*.8)).rgb;
  rgb*=.92+seed*.15;
  float edge=min(min(part.x,1.-part.x)*plank.x,min(part.y,1.-part.y)*plank.y);
  rgb*=mix(1.,mix(.48,1.,smoothstep(0.,.0017,edge)),grooves);
  float lighting=dot(texture2D(lightMap,p).rgb,vec3(.299,.587,.114));
  rgb*=clamp(lighting/ shade,.56,1.13);
  gl_FragColor=vec4(rgb,alpha);return;
 }
 if(inside(uv)<.5)discard;
 if(layer<2.5){vec2 inner=project(innerTransform,p);if(inner.x>=0.&&inner.x<=1.&&inner.y>=0.)discard;}
 vec3 rgb=tint;
 if(wood>.5){rgb=texture2D(grain,vec2(uv.y*.87,uv.x*.4)).rgb;}
 float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
 float bevel=mix(.68,1.,smoothstep(0.,.007,edge));
 rgb*=shade*bevel*(.98+.045*uv.x);
 if(layer>2.5){
  if(style>.5&&style<1.5){
   float strip=0.;for(int i=1;i<=4;i++){strip=max(strip,1.-smoothstep(.006,.011,abs(uv.y-float(i)*.2)));}
   strip*=smoothstep(.14,.155,uv.x)*(1.-smoothstep(.845,.86,uv.x));
   vec3 glass=vec3(.63,.68,.68)+vec3(.18)*uv.y;rgb=mix(rgb,glass,strip);
  }
  if(style>1.5){float line=max(1.-smoothstep(.001,.002,abs(uv.y-.3)),1.-smoothstep(.001,.002,abs(uv.y-.7)));line*=step(.08,uv.x)*step(uv.x,.92);rgb=mix(rgb,vec3(.52,.55,.56),line);}
  if(hiddenHinges<.5){float hx=handleSide>.5?.015:.985;float hinge=0.;for(int i=0;i<3;i++){float hy=.14+float(i)*.34;hinge=max(hinge,(1.-smoothstep(.006,.010,abs(uv.x-hx)))*(1.-smoothstep(.023,.025,abs(uv.y-hy))));}vec3 metal=vec3(.5+.38*cos((uv.x-hx)*240.));rgb=mix(rgb,metal,hinge);}

 }
 gl_FragColor=vec4(rgb,1.);
}`;
export type SceneAssets = {
  photo: HTMLImageElement;
  mask: HTMLImageElement;
  light: HTMLImageElement;
  hardware: HTMLImageElement;
  floor: HTMLImageElement;
  door: HTMLImageElement;
};
export class InteriorRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private textures = new Map<HTMLImageElement, WebGLTexture>();
  private loaded: SceneAssets | null = null;
  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      preserveDrawingBuffer: true,
      antialias: true,
    });
    if (!gl) throw Error("webglError");
    this.gl = gl;
    const compile = (kind: number, source: string) => {
      const s = gl.createShader(kind)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(s) || "webglError");
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex),
      fs = compile(gl.FRAGMENT_SHADER, fragment),
      program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error("webglError");
    this.program = program;
    gl.useProgram(program);
    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const p = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  render(
    s: InteriorPhoto,
    assets: SceneAssets,
    d: InteriorDesign,
    c: Catalog,
    view: PhotoView,
    width = 1920,
  ) {
    const gl = this.gl,
      u = (name: string) => gl.getUniformLocation(this.program, name);
    this.canvas.width = width;
    this.canvas.height = Math.round((width * s.height) / s.width);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    if (this.loaded !== assets) {
      this.textures.forEach((t) => gl.deleteTexture(t));
      this.textures.clear();
      this.loaded = assets;
    }
    const bind = (name: string, img: HTMLImageElement, unit: number) => {
      let tex = this.textures.get(img);
      const fresh = !tex;
      if (!tex) {
        tex = gl.createTexture()!;
        this.textures.set(img, tex);
      }
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (fresh) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const pot =
          !(img.width & (img.width - 1)) && !(img.height & (img.height - 1));
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_WRAP_S,
          pot ? gl.REPEAT : gl.CLAMP_TO_EDGE,
        );
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_WRAP_T,
          pot ? gl.REPEAT : gl.CLAMP_TO_EDGE,
        );
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          img,
        );
      }
      gl.uniform1i(u(name), unit);
    };
    const matrix = (name: string, points: Corners) => {
      const m = inverse(homography(points));
      gl.uniformMatrix3fv(
        u(name),
        false,
        new Float32Array([
          m[0],
          m[3],
          m[6],
          m[1],
          m[4],
          m[7],
          m[2],
          m[5],
          m[8],
        ]),
      );
    };
    const draw = (layer: number) => {
      gl.uniform1f(u("layer"), layer);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    bind("photo", assets.photo, 0);
    bind("mask", assets.mask, 2);
    bind("lightMap", assets.light, 3);
    bind("hardware", assets.hardware, 4);
    gl.uniform1f(u("zoom"), view.zoom);
    gl.uniform2f(u("pan"), view.x, view.y);
    draw(0);
    const floor = c.laminates.find((f) => f.id === d.laminateId)!;
    bind("grain", assets.floor, 1);
    matrix("transform", s.floorPlane);
    gl.uniform2f(u("meters"), ...s.floorMeters);
    gl.uniform2f(u("plank"), floor.plankLength / 100, floor.plankWidth / 100);
    gl.uniform1f(
      u("pattern"),
      d.pattern === "straight" ? 0 : d.pattern === "diagonal" ? 1 : 2,
    );
    gl.uniform1f(u("direction"), d.direction ? 1 : 0);
    gl.uniform1f(u("grooves"), floor.groove ? 1 : 0);
    gl.uniform1f(
      u("shade"),
      d.preset === "hallway" ? 0.38 : d.preset === "bedroom" ? 0.63 : 0.85,
    );
    gl.uniform3f(
      u("tint"),
      parseInt(floor.color.slice(1, 3), 16) / 255,
      parseInt(floor.color.slice(3, 5), 16) / 255,
      parseInt(floor.color.slice(5, 7), 16) / 255,
    );
    draw(1);
    const finish = c.productFinishes.find(
        (f) => f.id === d.doorStyle.finishId,
      )!,
      model = c.interiorDoors.find((f) => f.id === d.doorStyle.modelId)!,
      handle = c.interiorHandles.find((f) => f.id === d.doorStyle.handleId)!;
    const color = (name: string, hex: string) =>
      gl.uniform3f(
        u(name),
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255,
      );
    const skirt = c.skirtings.find((p) => p.id === d.skirtingId)!;
    color(
      "tint",
      skirt.mode === "white"
        ? "#f2f1ec"
        : skirt.mode === "floor"
          ? floor.color
          : finish.color,
    );
    gl.uniform1f(
      u("wood"),
      skirt.mode === "floor" || (skirt.mode === "door" && !!finish.texture)
        ? 1
        : 0,
    );
    bind("grain", skirt.mode === "door" ? assets.door : assets.floor, 1);
    draw(4);
    gl.uniform1f(u("hiddenHinges"), d.doorStyle.hiddenHinges ? 1 : 0);
    color("tint", finish.color);
    color("hardwareColor", handle.color);
    bind("grain", assets.door, 1);
    gl.uniform1f(u("wood"), finish.texture ? 1 : 0);
    gl.uniform1f(
      u("style"),
      model.style === "glass" ? 1 : model.style === "grooves" ? 2 : 0,
    );
    for (const door of s.doors) {
      matrix("transform", door.frame);
      matrix("innerTransform", door.opening || door.leaf);
      gl.uniform1f(u("shade"), door.shade);
      draw(2);
      matrix("transform", door.leaf);
      const anchor = projectPoint(homography(door.leaf), {
        x: door.handle[0],
        y: door.handle[1],
      });
      gl.uniform2f(u("handleAnchor"), anchor.x, anchor.y);
      gl.uniform2f(u("hardwareSize"), ...door.hardwareSize);
      gl.uniform1f(u("handleSide"), door.handleSide === "right" ? 1 : 0);
      draw(3);
      draw(5);
    }
    if (gl.getError() !== gl.NO_ERROR) throw Error("webglError");
  }
  dispose() {
    this.textures.forEach((t) => this.gl.deleteTexture(t));
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.program);
  }
}
