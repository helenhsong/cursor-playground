import { useEffect, useRef } from 'react'

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform float uRevealRadius;
uniform float uRevealSoftness;
uniform float uPixelSize;
uniform float uWaveSpeed;
uniform float uWaveFrequency;
uniform vec2 uResolution;
uniform float uCanvasAspect;
uniform float uImageAspect;

varying vec2 vUv;

float bayer2(vec2 point) {
  point = floor(point);
  return fract(point.x * 0.5 + point.y * point.y * 0.75);
}

float bayer4(vec2 point) {
  return bayer2(point * 0.5) * 0.25 + bayer2(point);
}

float bayer8(vec2 point) {
  return bayer4(point * 0.5) * 0.25 + bayer2(point);
}

float orderedTone(float gray, float threshold) {
  float adjusted = gray + (threshold - 0.5) * 0.52;
  return adjusted < 0.31 ? 0.0 : (adjusted < 0.68 ? 0.52 : 1.0);
}

vec2 coverUv(vec2 uv) {
  vec2 cover = uCanvasAspect < uImageAspect
    ? vec2(uCanvasAspect / uImageAspect, 1.0)
    : vec2(1.0, uImageAspect / uCanvasAspect);
  return (uv - 0.5) * cover + 0.5;
}

void main() {
  vec2 uv = vUv;
  float revealNorm = uRevealRadius / max(min(uResolution.x, uResolution.y), 1.0);
  float wave = sin(uv.y * uWaveFrequency + uTime * uWaveSpeed) * 0.005;
  wave += sin(uv.x * uWaveFrequency * 0.72 - uTime * uWaveSpeed * 0.76) * 0.003;

  float distanceToMouse = distance(uv, uMouse);
  float influence = smoothstep(revealNorm * 1.15, 0.0, distanceToMouse) * uMouseActive;
  float ripple = sin(distanceToMouse * 82.0 - uTime * 2.4) * 0.006 * influence;
  vec2 sampleUv = coverUv(uv + vec2(wave + ripple, wave * -0.65 + ripple));
  vec3 color = texture2D(uTexture, sampleUv).rgb;

  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  float tone = orderedTone(gray, bayer8(gl_FragCoord.xy / max(uPixelSize, 0.5)));
  vec3 ink = vec3(0.055, 0.052, 0.072);
  vec3 paper = vec3(0.94, 0.91, 0.82);
  vec3 dithered = mix(ink, paper, tone);

  float revealDistance = distance(uv * uResolution, uMouse * uResolution);
  float innerRadius = uRevealRadius * (1.0 - uRevealSoftness);
  float outerRadius = uRevealRadius * (1.0 + uRevealSoftness);
  float reveal = (1.0 - smoothstep(innerRadius, outerRadius, revealDistance)) * uMouseActive;
  vec3 finalColor = mix(dithered, color, reveal);

  gl_FragColor = vec4(finalColor, 1.0);
}
`

function compileShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Unable to compile dither shader')
  }
  return shader
}

export function DitherReveal({ imageSrc, settings }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return undefined
    canvas.classList.remove('is-loaded')

    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!gl) return undefined

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      return undefined
    }
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const uniform = (name) => gl.getUniformLocation(program, name)
    const uniforms = {
      time: uniform('uTime'),
      mouse: uniform('uMouse'),
      mouseActive: uniform('uMouseActive'),
      revealRadius: uniform('uRevealRadius'),
      revealSoftness: uniform('uRevealSoftness'),
      pixelSize: uniform('uPixelSize'),
      waveSpeed: uniform('uWaveSpeed'),
      waveFrequency: uniform('uWaveFrequency'),
      resolution: uniform('uResolution'),
      canvasAspect: uniform('uCanvasAspect'),
      imageAspect: uniform('uImageAspect'),
    }

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([17, 16, 25, 255]),
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    let imageAspect = 1
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      imageAspect = image.naturalWidth / image.naturalHeight
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      requestAnimationFrame(() => canvas.classList.add('is-loaded'))
    }
    image.src = imageSrc

    const mouse = { x: 0.5, y: 0.5, active: 0, target: 0 }
    function handlePointerMove(event) {
      const bounds = container.getBoundingClientRect()
      mouse.x = (event.clientX - bounds.left) / bounds.width
      mouse.y = 1 - (event.clientY - bounds.top) / bounds.height
      mouse.target = 1
    }
    function handlePointerEnter() {
      mouse.target = 1
    }
    function handlePointerLeave() {
      mouse.target = 0
    }

    function resize() {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(container.clientWidth * pixelRatio))
      canvas.height = Math.max(1, Math.floor(container.clientHeight * pixelRatio))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerenter', handlePointerEnter)
    container.addEventListener('pointerleave', handlePointerLeave)
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    const startedAt = performance.now()
    let frameId = 0
    function render() {
      frameId = requestAnimationFrame(render)
      mouse.active += (mouse.target - mouse.active) * 0.09

      gl.uniform1f(uniforms.time, (performance.now() - startedAt) / 1000)
      gl.uniform2f(uniforms.mouse, mouse.x, mouse.y)
      gl.uniform1f(uniforms.mouseActive, mouse.active)
      gl.uniform1f(uniforms.revealRadius, settings.revealRadius)
      gl.uniform1f(uniforms.revealSoftness, settings.softness)
      gl.uniform1f(uniforms.pixelSize, settings.dotSize / 2)
      gl.uniform1f(uniforms.waveSpeed, settings.waveSpeed)
      gl.uniform1f(uniforms.waveFrequency, settings.waveDensity)
      gl.uniform2f(uniforms.resolution, container.clientWidth || 1, container.clientHeight || 1)
      gl.uniform1f(uniforms.canvasAspect, canvas.width / canvas.height)
      gl.uniform1f(uniforms.imageAspect, imageAspect)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    render()

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerenter', handlePointerEnter)
      container.removeEventListener('pointerleave', handlePointerLeave)
      image.onload = null
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }, [imageSrc, settings])

  return (
    <div ref={containerRef} className="dither-reveal">
      <canvas ref={canvasRef} className="dither-reveal__canvas" aria-hidden="true" />
    </div>
  )
}
