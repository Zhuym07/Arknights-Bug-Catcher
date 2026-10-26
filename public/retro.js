// The 2D scene stays the source of truth for both drawing and touch coordinates.
// Only this presentation layer uses WebGL; HUD and result text remain native DOM.
export function createRetroEffect(source) {
  const output = document.createElement('canvas');
  output.className = 'retro-output';
  output.setAttribute('aria-hidden', 'true');
  const gl = output.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) return null;

  function compile(type, code) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }
  const vertex = compile(gl.VERTEX_SHADER, `
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `);
  const fragment = compile(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D scene;
    uniform vec2 sceneSize;
    uniform vec2 outputSize;
    uniform float time;
    varying vec2 uv;

    float bayer2(vec2 p) { return 2.0 * p.x + 3.0 * p.y - 4.0 * p.x * p.y; }
    float dither(vec2 p) {
      p = mod(p, 4.0);
      return (4.0 * bayer2(mod(p, 2.0)) + bayer2(floor(p / 2.0)) + 0.5) / 16.0 - 0.5;
    }
    void main() {
      float sceneAspect = sceneSize.x / sceneSize.y;
      float outputAspect = outputSize.x / outputSize.y;
      vec2 mapped = uv;
      if (outputAspect > sceneAspect) {
        mapped.x = (uv.x - 0.5) * outputAspect / sceneAspect + 0.5;
      } else {
        mapped.y = (uv.y - 0.5) * sceneAspect / outputAspect + 0.5;
      }
      bool inside = mapped.x >= 0.0 && mapped.x <= 1.0 && mapped.y >= 0.0 && mapped.y <= 1.0;
      mapped = clamp(mapped, 0.0, 1.0);
      vec2 pixel = floor(mapped * sceneSize);
      vec2 sampleUV = (pixel + 0.5) / sceneSize;
      vec2 centred = uv * 2.0 - 1.0;
      // Sub-pixel colour bleed at the edges, with no geometry or input distortion.
      vec2 bleed = vec2(0.45 * dot(centred, centred) / sceneSize.x, 0.0);
      vec3 color = inside ? texture2D(scene, sampleUV).rgb : vec3(0.153, 0.196, 0.278);
      color.r = mix(color.r, texture2D(scene, sampleUV + bleed).r, 0.35);
      color.b = mix(color.b, texture2D(scene, sampleUV - bleed).b, 0.35);

      // Steel-green shadows, amber highlights, and the stepped colour of old GPUs.
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luma), color, 0.86);
      color = (color - 0.5) * 1.16 + 0.5;
      color = color * vec3(0.96, 1.03, 0.95) + vec3(0.025, 0.012, -0.012);
      color += vec3(0.035, 0.014, -0.015) * smoothstep(0.45, 0.95, luma);
      color = floor(clamp(color, 0.0, 1.0) * 31.0 + dither(pixel) * 0.85 + 0.5) / 31.0;

      // Output-resolution scanlines avoid coarse moiré on small phone screens.
      float scanline = 0.975 + 0.025 * cos(gl_FragCoord.y * 3.14159265);
      float grain = fract(sin(dot(gl_FragCoord.xy / outputSize + mod(time, 60.0), vec2(12.9898, 78.233))) * 437.585);
      float vignette = 1.0 - 0.15 * pow(dot(centred * vec2(0.82, 0.92), centred * vec2(0.82, 0.92)), 1.2);
      color = color * scanline * vignette + (grain - 0.5) * 0.018;
      gl_FragColor = vec4(color, 1.0);
    }
  `);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.uniform1i(gl.getUniformLocation(program, 'scene'), 0);
  const sceneSize = gl.getUniformLocation(program, 'sceneSize');
  const outputSize = gl.getUniformLocation(program, 'outputSize');
  const time = gl.getUniformLocation(program, 'time');
  let textureWidth = 0, textureHeight = 0;
  source.after(output);
  // A lost GPU context must never hide the playable underlying canvas.
  output.addEventListener('webglcontextlost', () => {
    output.hidden = true;
    output.dispatchEvent(new Event('retro-unavailable'));
  });
  return {
    output,
    resize(width, height) {
      output.width = width;
      output.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(outputSize, width, height);
    },
    render(now) {
      if (output.hidden) return;
      if (source.width !== textureWidth || source.height !== textureHeight) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        textureWidth = source.width;
        textureHeight = source.height;
        gl.uniform2f(sceneSize, textureWidth, textureHeight);
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      }
      gl.uniform1f(time, now / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
  };
}
