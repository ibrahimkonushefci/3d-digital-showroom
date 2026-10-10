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
 if(layer>4.5){
  vec2 sOffset=vec2(handleSide>.5?-0.003:0.003,0.008);
  vec2 suv=(p-(handleAnchor+sOffset))/(hardwareSize*1.15)+.5;
  if(handleSide<.5)suv.x=1.-suv.x;
  float shadow=0.;
  if(inside(suv)>.5)shadow=texture2D(hardware,suv).a*.45;
  vec2 huv=(p-handleAnchor)/hardwareSize+.5;
  if(handleSide<.5)huv.x=1.-huv.x;
  if(inside(huv)<.5){
   if(shadow>.02){gl_FragColor=vec4(vec3(0.),shadow);return;}
   discard;
  }
  vec4 h=texture2D(hardware,huv);
  if(h.a<.05){
   if(shadow>.02){gl_FragColor=vec4(vec3(0.),shadow);return;}
   discard;
  }
  vec3 metal=h.rgb;
  if(hardwareColor.r<.3)metal=vec3(.03)+metal*.16;
  else if(hardwareColor.r>hardwareColor.b*1.3)metal*=vec3(1.15,.95,.55);
  else metal=mix(vec3(.52),metal,1.12);
  gl_FragColor=vec4(metal,h.a);
  return;
 }
 if(layer>3.5){
  float a=texture2D(mask,p).g;if(a<.005)discard;
  vec3 rgb=tint;
  if(wood>.5)rgb=texture2D(grain,vec2(p.y*10.,p.x*2.5)).rgb;
  float lum=dot(original.rgb,vec3(.299,.587,.114));
  gl_FragColor=vec4(rgb*clamp(lum/.82,.55,1.12),a);
  return;
 }
 vec2 uv=project(transform,p);
 if(layer<1.5){
  float alpha=texture2D(mask,p).r;if(alpha<.005)discard;
  vec2 pos=uv*meters; if(direction>.5)pos=pos.yx;
  if(pattern>.5)pos=mat2(.7071,-.7071,.7071,.7071)*pos;
  vec2 cell,part;
  if(pattern>1.5){float n=floor(plank.x/plank.y+.5);vec2 q=pos/plank.y,grid=floor(q);float band=mod(grid.x+grid.y,2.*n);
   if(band<n){cell=vec2(grid.x-band,grid.y);part=vec2((q.x-cell.x)/n,fract(q.y));}else{cell=vec2(grid.x,grid.y-(band-n));part=vec2((q.y-cell.y)/n,fract(q.x));}}
  else{float row=floor(pos.y/plank.y);pos.x+=mod(row,3.)*plank.x*.33;cell=floor(pos/plank);part=fract(pos/plank);}
  float seed=hash(cell);vec3 rgb=texture2D(grain,vec2(part.x*.82+seed*.18,part.y*.18+seed*.82)).rgb;
  rgb*=.93+seed*.14;
  float edge=min(min(part.x,1.-part.x)*plank.x,min(part.y,1.-part.y)*plank.y);
  rgb*=mix(1.,mix(.48,1.,smoothstep(0.,.0018,edge)),grooves);
  float lighting=dot(texture2D(lightMap,p).rgb,vec3(.299,.587,.114));
  rgb*=clamp(lighting/shade,.58,1.15);
  gl_FragColor=vec4(rgb,alpha);return;
 }
 if(layer<2.5){
  if(uv.y>1.)discard;
  float dOut=max(max(-uv.x,uv.x-1.),-uv.y);
  if(dOut>0.){
   if(dOut<.028){
    float wallShadow=smoothstep(.028,0.,dOut)*.38;
    gl_FragColor=vec4(vec3(0.),wallShadow);
    return;
   }
   discard;
  }
  if(inside(uv)<.5)discard;
  vec2 inner=project(innerTransform,p);
  if(inner.x>=0.&&inner.x<=1.&&inner.y>=0.)discard;
  vec3 rgb=tint;
  bool isTop=(uv.y<uv.x)&&(uv.y<(1.-uv.x));
  if(wood>.5){
   if(isTop)rgb=texture2D(grain,vec2(uv.y*4.,uv.x*1.5)).rgb;
   else rgb=texture2D(grain,vec2(uv.x*4.,uv.y*1.5)).rgb;
  }
  float miterDist=min(abs(uv.y-uv.x),abs(uv.y-(1.-uv.x)));
  if(uv.y<.16&&miterDist<.0035)rgb*=mix(.72,1.,miterDist/.0035);
  float edge=min(min(uv.x,1.-uv.x),uv.y);
  float bevel=mix(.72,1.,smoothstep(0.,.008,edge));
  float innerDist=min(min(max(0.,-inner.x),max(0.,inner.x-1.)),max(0.,-inner.y));
  float jambShadow=mix(.78,1.,smoothstep(0.,.015,innerDist));
  float lighting=dot(texture2D(lightMap,p).rgb,vec3(.299,.587,.114));
  rgb*=shade*bevel*jambShadow*clamp(lighting/shade,.82,1.18);
  gl_FragColor=vec4(rgb,1.);
  return;
 }
 if(inside(uv)<.5)discard;
 vec3 rgb=tint;
 if(wood>.5)rgb=texture2D(grain,vec2(uv.x*1.,uv.y*2.2)).rgb;
 float leafEdge=min(min(uv.x,1.-uv.x),uv.y);
 float gap=mix(.18,1.,smoothstep(0.,.007,leafEdge));
 rgb*=gap;
 float lighting=dot(texture2D(lightMap,p).rgb,vec3(.299,.587,.114));
 rgb*=shade*clamp(lighting/shade,.85,1.15)*(.97+.05*uv.x);
 if(style>1.5){
  for(int i=1;i<=4;i++){
   float gy=float(i)*.2;
   float dy=uv.y-gy;
   if(abs(dy)<.0045&&uv.x>.06&&uv.x<.94){
    if(dy<0.)rgb*=mix(.52,1.,(-dy)/.0045);
    else rgb+=vec3(.13)*(1.-dy/.0045);
   }
  }
 }
 if(style>.5&&style<1.5){
  for(int i=1;i<=4;i++){
   float gy=float(i)*.2;
   float dy=abs(uv.y-gy);
   if(dy<.022&&uv.x>.14&&uv.x<.86){
    if(dy>.018||uv.x<.146||uv.x>.854)rgb=mix(rgb,vec3(.2),.85);
    else rgb=vec3(.82,.85,.86)+vec3(.06)*(1.-dy/.022);
   }
  }
 }
 if(hiddenHinges<.5){
  float hx=handleSide>.5?.015:.985;
  float hinge=0.;
  for(int i=0;i<3;i++){
   float hy=.14+float(i)*.34;
   hinge=max(hinge,(1.-smoothstep(.006,.010,abs(uv.x-hx)))*(1.-smoothstep(.023,.025,abs(uv.y-hy))));
  }
  vec3 metal=vec3(.52+.36*cos((uv.x-hx)*240.));
  rgb=mix(rgb,metal,hinge);
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
