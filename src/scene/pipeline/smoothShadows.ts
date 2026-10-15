import { ShaderChunk } from "three";

/**
 * Smooth percentage-closer filtering for spot and directional shadows.
 *
 * three.js r180's PCF takes 17 hard depth comparisons spread over ±radius
 * texels. With a soft radius (8 on the window light) every shadow edge prints
 * as several stair-stepped copies of the texel grid: the blocky halos behind
 * decor and inside open cabinets. This keeps the same footprint and softness
 * but takes a 5 × 5 tent-weighted grid of bilinear comparisons, so edges
 * fade continuously. It is noise-free (no per-pixel rotation), so nothing
 * shimmers or looks grainy. Point-light shadows are unchanged.
 */
const PCF_START = "#if defined( SHADOWMAP_TYPE_PCF )";
const PCF_END = "#elif defined( SHADOWMAP_TYPE_PCF_SOFT )";
const GET_SHADOW = "float getShadow(";

const HELPER = /* glsl */ `
	float smoothShadowTap( sampler2D shadowMap, vec2 mapSize, vec2 uv, float compare ) {
		vec2 texel = vec2( 1.0 ) / mapSize;
		vec2 f = fract( uv * mapSize + 0.5 );
		vec2 base = uv - f * texel;
		float a = texture2DCompare( shadowMap, base, compare );
		float b = texture2DCompare( shadowMap, base + vec2( texel.x, 0.0 ), compare );
		float c = texture2DCompare( shadowMap, base + vec2( 0.0, texel.y ), compare );
		float d = texture2DCompare( shadowMap, base + texel, compare );
		return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
	}

`;

const SMOOTH_PCF = /* glsl */ `#if defined( SHADOWMAP_TYPE_PCF )

			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			vec2 stepSize = texelSize * max( shadowRadius, 1.0 ) * 0.5;
			float total = 0.0;
			for ( int i = - 2; i <= 2; i ++ ) {
				for ( int j = - 2; j <= 2; j ++ ) {
					float w = ( 3.0 - abs( float( i ) ) ) * ( 3.0 - abs( float( j ) ) );
					total += w * smoothShadowTap( shadowMap, shadowMapSize, shadowCoord.xy + vec2( float( i ), float( j ) ) * stepSize, shadowCoord.z );
				}
			}
			shadow = total * ( 1.0 / 81.0 );

		`;

/** Rewrites the shadow chunk; returns false (leaving it untouched) if the
 * three.js source no longer has the expected shape. */
export function smoothShadowChunk(source: string): string | null {
  const start = source.indexOf(PCF_START);
  const end = source.indexOf(PCF_END, start);
  const getShadow = source.indexOf(GET_SHADOW);
  if (start < 0 || end < 0 || getShadow < 0 || getShadow > start) return null;
  return (
    source.slice(0, getShadow) +
    HELPER +
    source.slice(getShadow, start) +
    SMOOTH_PCF +
    source.slice(end)
  );
}

let installed = false;
/** Must run before the first material compiles (module load of Rendering). */
export function installSmoothShadows() {
  if (installed) return true;
  const next = smoothShadowChunk(ShaderChunk.shadowmap_pars_fragment);
  if (!next) {
    console.warn("Smooth shadows: unexpected three.js shadow chunk, kept PCF");
    return false;
  }
  (ShaderChunk as Record<string, string>).shadowmap_pars_fragment = next;
  installed = true;
  return true;
}
