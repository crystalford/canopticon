/* THREEJS RENDERER — Layer 1+2 (GROUND + TRANSFORM), procedural.
 *
 * A WebGL rendering backend for procedural ground geometry, warp fields,
 * and noise. This implements the bottom of the four-layer pipeline:
 *
 * Layer 1 (GROUND): WebGL base render with procedural geometry/materials
 * Layer 2 (TRANSFORM): warp fields (radial/linear/turbulent), fBm noise,
 *   temporal drift, parallax depth
 * Layer 3 (IMAGERY): generated/fetched imagery — scaffolded, not wired
 *   (see imagery.js; awaits a FLUX decision)
 * Layer 4 (COMPOSITION): editorial type over the ground — see
 *   composition.js, wired live
 *
 * The renderer receives a FilmCut with renderBackend='threejs-procedural'
 * and threeConfig containing noise intensity, warp field type, and
 * parallax depth, all derived deterministically from the film's own
 * settings (chaos/density) in cut/index.ts.
 *
 * WHY AN OFFSCREEN CANVAS: a <canvas> element binds to exactly one
 * context type for its lifetime — once something calls `getContext("2d")`
 * on it, a later `getContext("webgl2")` on the SAME element returns null.
 * The visible stage canvas is owned by Canvas 2D (it's what the type
 * layer and the legacy backend both draw into), so WebGL renders into a
 * private offscreen canvas and its pixels are read back and composited
 * onto the visible one — never the other way around.
 */

import { mulberry32 } from "../core/rng.js";

/* ── initialization ────────────────────────────────────────────────── */

/**
 * Initialize a Three.js/WebGL renderer sized to match `canvas` (the
 * visible stage element). Returns an object with `renderFrame` and
 * `dispose`. `renderFrame` returns ground pixel data only — the caller
 * (view-film.js) composites it onto the visible 2D context and then
 * draws the type layer on top via composition.js.
 */
export function initThreeJSRenderer(canvas, cut) {
  const config = cut.threeConfig || {
    noiseIntensity: 0.5,
    warpFieldType: "radial",
    parallaxDepth: 0.25,
    includeImageryLayer: false,
  };

  const width = canvas.width || 1280;
  const height = canvas.height || 720;

  // Private offscreen canvas — see file header. Never the visible stage.
  const glCanvas = document.createElement("canvas");
  glCanvas.width = width;
  glCanvas.height = height;
  const gl = glCanvas.getContext("webgl2", { premultipliedAlpha: true });
  if (!gl) {
    throw new Error("WebGL 2 not supported");
  }

  gl.viewport(0, 0, width, height);

  // PRNG for deterministic procedural generation
  const rng = mulberry32(cut.seed);

  // Layer 1: Ground plane with procedural geometry
  const groundGeometry = buildProceduralGeometry(width, height, config, rng);
  const groundShaders = buildShaders(gl, config);

  // State tracking across frame renders
  const state = {
    gl,
    width,
    height,
    config,
    rng,
    groundGeometry,
    groundShaders,
    time: 0,
  };

  return {
    renderFrame(beatIndex, timeInBeat) {
      return renderThreeFrame(state, beatIndex, timeInBeat);
    },
    dispose() {
      disposeThreeState(state);
    },
  };
}

/* ── procedural geometry (Layer 1) ────────────────────────────────── */

/**
 * Build a base procedural grid/mesh for the ground layer.
 * Deterministic based on seed and config.
 */
function buildProceduralGeometry(width, height, config, rng) {
  const density = config.noiseIntensity;
  const segments = 16 + Math.floor(density * 24); // 16..40 segments

  // Simple grid geometry: position + normal + uv
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Build grid vertices with height variation based on Perlin-like noise
  for (let y = 0; y <= segments; y++) {
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const v = y / segments;

      // Simple layered noise simulation using multiple sine waves
      const noise =
        Math.sin(u * Math.PI * 3 + rng() * 2) * 0.1 +
        Math.sin(v * Math.PI * 3 + rng() * 2) * 0.1 +
        Math.sin((u + v) * Math.PI * 5 + rng() * 2) * 0.05;

      const height = noise * density * 0.3; // Height variation

      positions.push(u * 2 - 1, height, v * 2 - 1);
      normals.push(0, 1, 0); // Simplified normals
      uvs.push(u, v);
    }
  }

  // Build index buffer for triangle strips
  for (let y = 0; y < segments; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;

      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    vertexCount: indices.length,
  };
}

/* ── shaders (Layer 1 + 2) ─────────────────────────────────────────── */

/**
 * Create shader programs for ground rendering with warp fields and noise.
 * Layer 2 (TRANSFORM) adds sophisticated warp field types, fBm noise,
 * and temporal drift patterns for complex deformations.
 */
function buildShaders(gl, config) {
  // Warp field type determines the deformation pattern (radial/linear/turbulent)
  const warpTypeIndex =
    config.warpFieldType === "radial" ? 0 : config.warpFieldType === "linear" ? 1 : 2;

  const vertexSource = `#version 300 es
    precision highp float;

    in vec3 position;
    in vec3 normal;
    in vec2 uv;

    uniform mat4 projection;
    uniform mat4 view;
    uniform float time;
    uniform float warpIntensity;
    uniform int warpType;  // 0=radial, 1=linear, 2=turbulent

    out vec3 vNormal;
    out vec2 vUv;
    out vec3 vPosition;

    // Fractional Brownian Motion (fBm) for natural-looking noise
    float fbm(vec3 p, float t) {
      float value = 0.0;
      float amplitude = 1.0;
      float frequency = 1.0;
      float max_value = 0.0;

      for (int i = 0; i < 4; i++) {
        // Layered sine waves with varying frequencies
        value += amplitude *
          sin(p.x * frequency + t * 0.3) *
          sin(p.z * frequency * 0.7 + t * 0.2) *
          sin((p.x + p.z) * frequency * 0.5 + t * 0.4);
        max_value += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
      }
      return value / max_value;
    }

    void main() {
      vec3 pos = position;
      float warp = 0.0;

      if (warpType == 0) {
        // Radial warp: swirl around center, drifts over time
        float dist = length(pos.xz);
        float angle = atan(pos.z, pos.x);
        float spiral = sin(dist * 3.0 + angle * 2.0 + time * 0.4) * 0.1;
        warp = spiral + fbm(pos, time) * 0.05;
        pos.y += warp * warpIntensity;

      } else if (warpType == 1) {
        // Linear warp: directional flow, like wind or current
        float flow_x = sin(pos.x * 2.0 + time * 0.6) * 0.1;
        float flow_z = cos(pos.z * 2.0 + time * 0.5) * 0.1;
        warp = flow_x + flow_z + fbm(pos, time) * 0.08;
        pos.x += flow_x * warpIntensity * 0.3;
        pos.z += flow_z * warpIntensity * 0.3;
        pos.y += warp * warpIntensity;

      } else {
        // Turbulent warp: chaotic, swirling deformation
        float turb = fbm(pos * 1.5, time);
        float chaotic_x = sin(pos.x * 4.0 + time * 0.7 + turb * 2.0) * 0.15;
        float chaotic_z = sin(pos.z * 4.0 + time * 0.5 + turb * 1.5) * 0.15;
        warp = turb * 0.2 + sin(time + length(pos.xz)) * 0.1;
        pos.x += chaotic_x * warpIntensity;
        pos.z += chaotic_z * warpIntensity;
        pos.y += warp * warpIntensity;
      }

      // Enhanced parallax: depth varies with warp for more dramatic effect
      float depth_scale = 0.1 + length(vec2(warp)) * 0.2;
      pos.z += uv.x * uv.y * depth_scale * warpIntensity;

      // Temporal drift: vertices drift slightly based on their position and time
      pos.x += sin(time * 0.3 + uv.x * 5.0) * 0.02 * warpIntensity;
      pos.z += cos(time * 0.25 + uv.y * 5.0) * 0.02 * warpIntensity;

      gl_Position = projection * view * vec4(pos, 1.0);
      vNormal = normal;
      vUv = uv;
      vPosition = pos;
    }
  `;

  const fragmentSource = `#version 300 es
    precision highp float;

    in vec3 vNormal;
    in vec2 vUv;
    in vec3 vPosition;

    uniform float time;
    uniform float density;

    out vec4 outColor;

    // Hash function for pseudo-random values
    float hash(float x) {
      return fract(sin(x) * 43758.5453);
    }

    void main() {
      // fBm: layered sine octaves, decaying amplitude, summed — this is
      // what CENTRES the field near 0.5 rather than near its dark end, which
      // is what made the first version of this shader render nearly solid
      // black: a low-mean field can almost never clear a threshold near 0.7.
      float n = 0.0;
      float amp = 0.5;
      float freq = 3.0;
      for (int i = 0; i < 4; i++) {
        n += amp * sin(vPosition.x * freq + vPosition.z * freq * 0.8 + time * 0.15 * float(i + 1));
        freq *= 2.0;
        amp *= 0.55;
      }
      float base = n * 0.5 + 0.5;

      // Fold in the SAME height signal the vertex shader warped the mesh
      // with, so the texture visibly tracks the warp field rather than
      // reading as an unrelated decorative overlay on top of it.
      base = clamp(base + vPosition.y * 0.9, 0.0, 1.0);

      // Fine dither grain — the photocopy's actual grain, same role as
      // frame.js's f.grain term in the Canvas 2D material pass.
      float grain = fract(sin(vPosition.x * 91.7 + vPosition.z * 53.3 + time * 0.05) * 43758.5453);
      base = mix(base, grain, 0.12);

      // THRESHOLD WOBBLES around 0.5 — frame.js's own photocopy technique
      // (t = 0.5 + wobble), rather than the field being pushed toward a
      // fixed cutoff. This is what makes it read as printing, not filtering.
      float wobble = (sin(vPosition.x * 6.0 + time * 0.2) + sin(vPosition.z * 6.0 - time * 0.17)) * 0.06;
      float threshold = 0.5 + wobble * density;
      float final = step(threshold, base);

      outColor = vec4(final, final, final, 1.0);
    }
  `;

  const program = createShaderProgram(gl, vertexSource, fragmentSource);

  return {
    program,
    uniforms: {
      projection: gl.getUniformLocation(program, "projection"),
      view: gl.getUniformLocation(program, "view"),
      time: gl.getUniformLocation(program, "time"),
      warpIntensity: gl.getUniformLocation(program, "warpIntensity"),
      density: gl.getUniformLocation(program, "density"),
      warpType: gl.getUniformLocation(program, "warpType"),
    },
    attributes: {
      position: gl.getAttribLocation(program, "position"),
      normal: gl.getAttribLocation(program, "normal"),
      uv: gl.getAttribLocation(program, "uv"),
    },
    warpTypeValue: warpTypeIndex,
  };
}

function createShaderProgram(gl, vertexSrc, fragmentSrc) {
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertex, vertexSrc);
  gl.compileShader(vertex);
  if (!gl.getShaderParameter(vertex, gl.COMPILE_STATUS)) {
    console.error("Vertex shader error:", gl.getShaderInfoLog(vertex));
  }

  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragment, fragmentSrc);
  gl.compileShader(fragment);
  if (!gl.getShaderParameter(fragment, gl.COMPILE_STATUS)) {
    console.error("Fragment shader error:", gl.getShaderInfoLog(fragment));
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
  }

  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  return program;
}

/* ── frame rendering ───────────────────────────────────────────────── */

/**
 * Render a single frame at the given beat index and time within beat.
 * Stores the result in the WebGL backbuffer, which can then be read
 * into a Canvas 2D context for display/export.
 */
function renderThreeFrame(state, beatIndex, timeInBeat) {
  const { gl, width, height, groundGeometry, groundShaders, config } = state;

  // Update time-based uniforms
  state.time = (beatIndex * 0.1 + timeInBeat) % 100;

  // Clear the backbuffer
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);

  // Use the ground shader program
  gl.useProgram(groundShaders.program);

  // Set up matrices (simple orthographic for now)
  const projection = orthoMatrix(-1, 1, -1, 1, 0.1, 100);
  const view = lookAtMatrix([0, 2, 2], [0, 0, 0], [0, 1, 0]);

  gl.uniformMatrix4fv(groundShaders.uniforms.projection, false, projection);
  gl.uniformMatrix4fv(groundShaders.uniforms.view, false, view);
  gl.uniform1f(groundShaders.uniforms.time, state.time);
  gl.uniform1f(groundShaders.uniforms.warpIntensity, config.noiseIntensity);
  gl.uniform1f(groundShaders.uniforms.density, config.noiseIntensity);
  gl.uniform1i(groundShaders.uniforms.warpType, groundShaders.warpTypeValue);

  // Bind geometry and render
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Position attribute
  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, groundGeometry.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(groundShaders.attributes.position);
  gl.vertexAttribPointer(groundShaders.attributes.position, 3, gl.FLOAT, false, 0, 0);

  // UV attribute
  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, groundGeometry.uvs, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(groundShaders.attributes.uv);
  gl.vertexAttribPointer(groundShaders.attributes.uv, 2, gl.FLOAT, false, 0, 0);

  // Index buffer
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, groundGeometry.indices, gl.STATIC_DRAW);

  // Draw
  gl.drawElements(gl.TRIANGLES, groundGeometry.vertexCount, gl.UNSIGNED_INT, 0);

  // Read pixels from the WebGL context for display
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // Clean up
  gl.deleteVertexArray(vao);
  gl.deleteBuffer(posBuffer);
  gl.deleteBuffer(uvBuffer);
  gl.deleteBuffer(indexBuffer);

  // Return Uint8ClampedArray for Canvas 2D ImageData
  return new Uint8ClampedArray(pixels);
}

/* ── matrix math ──────────────────────────────────────────────────── */

function orthoMatrix(left, right, bottom, top, near, far) {
  const result = new Float32Array(16);
  const rl = right - left;
  const tb = top - bottom;
  const fn = far - near;

  result[0] = 2 / rl;
  result[5] = 2 / tb;
  result[10] = -2 / fn;
  result[12] = -(left + right) / rl;
  result[13] = -(top + bottom) / tb;
  result[14] = -(far + near) / fn;
  result[15] = 1;

  return result;
}

function lookAtMatrix(eye, center, up) {
  const result = new Float32Array(16);

  const f = normalize(subtract(center, eye));
  const s = normalize(cross(f, up));
  const u = cross(s, f);

  result[0] = s[0];
  result[4] = s[1];
  result[8] = s[2];

  result[1] = u[0];
  result[5] = u[1];
  result[9] = u[2];

  result[2] = -f[0];
  result[6] = -f[1];
  result[10] = -f[2];

  result[3] = 0;
  result[7] = 0;
  result[11] = 0;

  result[12] = -dot(s, eye);
  result[13] = -dot(u, eye);
  result[14] = dot(f, eye);
  result[15] = 1;

  return result;
}

const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const normalize = (v) => {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* ── cleanup ──────────────────────────────────────────────────────── */

function disposeThreeState(state) {
  const { gl } = state;
  gl.deleteProgram(state.groundShaders.program);
}
