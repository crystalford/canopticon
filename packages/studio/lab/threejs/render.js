/* THREEJS RENDERER — Layer 1 (GROUND).
 *
 * A new rendering backend using Three.js/WebGL for procedural transformations,
 * noise fields, and advanced material handling. This implements Layer 1 of the
 * multi-pass rendering architecture:
 *
 * Layer 1 (GROUND): Three.js WebGL base render with procedural geometry/materials
 * Layer 2 (TRANSFORM): Noise fields, warp deformation, parallax depth
 * Layer 3 (IMAGERY): Generated/fetched imagery layers (FLUX, etc.)
 * Layer 4 (COMPOSITION): Canvas 2D overlay, final composite, UI chrome
 *
 * The renderer receives a FilmCut with renderBackend='threejs-procedural' and
 * threeConfig containing noise intensity, warp field type, and parallax depth.
 */

import { mulberry32 } from "../core/rng.js";

/* ── initialization ────────────────────────────────────────────────── */

/**
 * Initialize a Three.js renderer for a given canvas and film cut.
 * Returns an object with methods to render frames and clean up.
 */
export function initThreeJSRenderer(canvas, cut) {
  const config = cut.threeConfig || {
    noiseIntensity: 0.5,
    warpFieldType: "radial",
    parallaxDepth: 0.25,
    includeImageryLayer: false,
  };

  // Placeholder WebGL context and geometry state
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true });
  if (!gl) {
    throw new Error("WebGL 2 not supported");
  }

  const width = canvas.width || 1280;
  const height = canvas.height || 720;
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
 */
function buildShaders(gl, config) {
  const vertexSource = `#version 300 es
    precision highp float;

    in vec3 position;
    in vec3 normal;
    in vec2 uv;

    uniform mat4 projection;
    uniform mat4 view;
    uniform float time;
    uniform float warpIntensity;

    out vec3 vNormal;
    out vec2 vUv;
    out vec3 vPosition;

    void main() {
      vec3 pos = position;

      // Layer 2: Warp field (deterministic based on config)
      // Simple sine-wave warping for procedural deformation
      float warp = sin(pos.x * 3.0 + time * 0.5) * 0.1 +
                   sin(pos.z * 3.0 + time * 0.3) * 0.1;
      pos.y += warp * warpIntensity;

      // Parallax depth effect (move vertices slightly based on depth)
      pos.z += uv.x * uv.y * 0.2 * warpIntensity;

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

    void main() {
      // Monochrome procedural material (Layer 1)
      // Base value from UV gradients
      float base = fract(vUv.x * 8.0) * fract(vUv.y * 8.0);

      // Add temporal modulation
      float temporal = sin(time * 0.5) * 0.5 + 0.5;
      float value = base * temporal * density;

      // Threshold degradation based on intensity
      float threshold = 0.5 + density * 0.3;
      float final = step(threshold, value);

      // Add subtle noise
      float noise = fract(sin(vPosition.x * 12.47 + vPosition.z * 34.1) * 43758.5);
      final = mix(final, noise, 0.1);

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
    },
    attributes: {
      position: gl.getAttribLocation(program, "position"),
      normal: gl.getAttribLocation(program, "normal"),
      uv: gl.getAttribLocation(program, "uv"),
    },
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
