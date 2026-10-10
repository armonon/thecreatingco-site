// WebGL2 preview for Grade: draws an image/video frame through a 3D LUT with
// hardware trilinear filtering, with a before/after split. The LUT is the same
// table that is exported as .cube, so the preview is exactly the export.

const VERTEX = `#version 300 es
in vec2 position;
out vec2 uv;
void main() {
  uv = vec2((position.x + 1.0) * 0.5, 1.0 - (position.y + 1.0) * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 uv;
out vec4 color;
uniform sampler2D frame;
uniform sampler3D lut;
uniform float lutSize;
uniform float split;
void main() {
  vec4 source = texture(frame, uv);
  // Sample lattice centres so 0 and 1 hit the first and last LUT entries.
  vec3 coord = source.rgb * ((lutSize - 1.0) / lutSize) + 0.5 / lutSize;
  vec3 graded = texture(lut, coord).rgb;
  color = vec4(uv.x < split ? source.rgb : graded, 1.0);
}`;

export type LutRenderer = {
  setLut(rgba: Uint8Array, size: number): void;
  draw(source: TexImageSource, split: number): void;
  dispose(): void;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader failed to compile.");
  return shader;
}

/** Returns null when WebGL2 isn't available, so the caller can fall back to the CPU path. */
export function createLutRenderer(canvas: HTMLCanvasElement): LutRenderer | null {
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Shader failed to link.");
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const frameTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, frameTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const lutTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, lutTexture);
  for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, parameter, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.uniform1i(gl.getUniformLocation(program, "frame"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "lut"), 1);
  const lutSize = gl.getUniformLocation(program, "lutSize");
  const split = gl.getUniformLocation(program, "split");

  return {
    setLut(rgba, size) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, lutTexture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      // .cube order is r fastest, then g, then b = texture x, y, z.
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      gl.uniform1f(lutSize, size);
    },
    draw(source, splitAt) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, frameTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform1f(split, splitAt);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteTexture(frameTexture);
      gl.deleteTexture(lutTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
