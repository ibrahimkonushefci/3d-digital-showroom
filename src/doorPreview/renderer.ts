import { homography, inverse, type Corners } from "./homography";
export type RenderPlacement = {
  corners: Corners;
  image: HTMLImageElement;
  brightness: number;
  color?: string;
  photo?: HTMLImageElement;
  frame?: HTMLImageElement;
  glass?: HTMLImageElement;
};
const vertex = `attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;uniform sampler2D image;uniform sampler2D photo;uniform mat3 inverseH;uniform vec2 resolution;uniform float brightness;uniform vec3 balance;uniform vec3 tint;uniform float recolor;uniform float layer;void main(){vec2 p=vec2(gl_FragCoord.x/resolution.x,1.-gl_FragCoord.y/resolution.y);vec3 q=inverseH*vec3(p,1.);vec2 uv=q.xy/q.z;float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));if(edge<0.){if(layer>.5||edge<-.025)discard;gl_FragColor=vec4(0.,0.,0.,.16*exp(edge*100.));return;}vec4 c=texture2D(image,uv);float shade=mix(.65,1.,smoothstep(0.,.035,edge));vec3 rgb=c.rgb;if(layer>1.5){vec3 reflected=texture2D(photo,vec2(uv.x,1.-uv.y)).rgb;rgb=mix(rgb,reflected,.65);c.a*=.48;}if(recolor>.5){float gray=dot(rgb,vec3(.299,.587,.114));float chroma=max(max(rgb.r,rgb.g),rgb.b)-min(min(rgb.r,rgb.g),rgb.b);rgb=mix(rgb,tint*(gray+.15),1.-smoothstep(.04,.2,chroma));}gl_FragColor=vec4(rgb*brightness*shade*balance,c.a);}`;
/** Match surrounding opening pixels; neutral defaults preserve manually imported assets. */
export function sampleMatch(
  photo: HTMLImageElement | undefined,
  corners: Corners,
) {
  if (!photo) return { brightness: 1, balance: [1, 1, 1] };
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(photo, 0, 0, 128, 128);
    const data = ctx.getImageData(0, 0, 128, 128).data,
      center = {
        x: corners.reduce((n, p) => n + p.x, 0) / 4,
        y: corners.reduce((n, p) => n + p.y, 0) / 4,
      },
      sum = [0, 0, 0];
    let count = 0;
    for (let e = 0; e < 4; e++)
      for (let i = 0; i < 12; i++) {
        const a = corners[e],
          b = corners[(e + 1) % 4],
          t = i / 11,
          x = a.x * (1 - t) + b.x * t,
          y = a.y * (1 - t) + b.y * t;
        const sx = Math.max(
            0,
            Math.min(127, Math.round((x + (x - center.x) * 0.08) * 128)),
          ),
          sy = Math.max(
            0,
            Math.min(127, Math.round((y + (y - center.y) * 0.08) * 128)),
          ),
          idx = (sy * 128 + sx) * 4;
        sum.forEach((_, k) => (sum[k] += data[idx + k] / 255));
        count++;
      }
    const avg = sum.map((n) => n / count),
      mean = avg.reduce((a, b) => a + b) / 3;
    return {
      brightness: Math.max(0.65, Math.min(1.3, mean / 0.68)),
      balance: avg.map((n) =>
        Math.max(0.8, Math.min(1.2, n / Math.max(0.1, mean))),
      ),
    };
  } catch {
    return { brightness: 1, balance: [1, 1, 1] };
  }
}
export class PhotoRenderer {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  textures: WebGLTexture[] = [];
  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw Error("webglError");
    this.gl = gl;
    const compile = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(s) || "webglError");
      return s;
    };
    const v = compile(gl.VERTEX_SHADER, vertex),
      f = compile(gl.FRAGMENT_SHADER, fragment);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, v);
    gl.attachShader(this.program, f);
    gl.linkProgram(this.program);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw Error("webglError");
    gl.useProgram(this.program);
    const buffer = gl.createBuffer()!;
    this.buffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const location = gl.getAttribLocation(this.program, "position");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  render(width: number, height: number, placements: RenderPlacement[]) {
    const gl = this.gl;
    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    this.textures.forEach((t) => gl.deleteTexture(t));
    this.textures = [];
    const uniform = (name: string) => gl.getUniformLocation(this.program, name);
    gl.uniform2f(uniform("resolution"), width, height);
    gl.uniform1i(uniform("image"), 0);
    for (const p of placements) {
      const m = inverse(homography(p.corners));
      gl.uniformMatrix3fv(
        uniform("inverseH"),
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
      const match = sampleMatch(p.photo, p.corners);
      gl.uniform1f(uniform("brightness"), p.brightness * match.brightness);
      gl.uniform3f(
        uniform("balance"),
        match.balance[0],
        match.balance[1],
        match.balance[2],
      );
      const hex = p.color || "#ffffff";
      gl.uniform3f(
        uniform("tint"),
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255,
      );
      gl.uniform1f(uniform("recolor"), p.color ? 1 : 0);
      const bind = (
        source: HTMLImageElement | HTMLCanvasElement,
        unit: number,
      ) => {
        const tex = gl.createTexture()!;
        this.textures.push(tex);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          source,
        );
      };
      if (p.photo) {
        const blurred = document.createElement("canvas");
        blurred.width = blurred.height = 64;
        const x = Math.min(...p.corners.map((c) => c.x)),
          y = Math.min(...p.corners.map((c) => c.y)),
          w = Math.max(...p.corners.map((c) => c.x)) - x,
          h = Math.max(...p.corners.map((c) => c.y)) - y;
        blurred
          .getContext("2d")!
          .drawImage(
            p.photo,
            x * p.photo.naturalWidth,
            y * p.photo.naturalHeight,
            w * p.photo.naturalWidth,
            h * p.photo.naturalHeight,
            0,
            0,
            64,
            64,
          );
        bind(blurred, 1);
        gl.uniform1i(uniform("photo"), 1);
      } else bind(p.image, 1);
      const layers = [p.image, p.frame, p.glass];
      layers.forEach((source, i) => {
        if (!source) return;
        bind(source, 0);
        gl.uniform1f(uniform("layer"), i);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });
    }
  }
  dispose() {
    this.textures.forEach((t) => this.gl.deleteTexture(t));
    this.gl.deleteProgram(this.program);
    this.gl.deleteBuffer(this.buffer);
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
