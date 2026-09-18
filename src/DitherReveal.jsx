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

function createArtwork() {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 800
  const context = canvas.getContext('2d')

  const background = context.createLinearGradient(0, 0, 1200, 800)
  background.addColorStop(0, '#ef775f')
  background.addColorStop(0.42, '#e85c8f')
  background.addColorStop(1, '#4d65c9')
  context.fillStyle = background
  context.fillRect(0, 0, 1200, 800)

  context.fillStyle = '#ffe69a'
  context.beginPath()
  context.arc(940, 174, 132, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#43c6b6'
  context.beginPath()
  context.moveTo(0, 485)
  context.bezierCurveTo(210, 355, 420, 520, 620, 420)
  context.bezierCurveTo(845, 305, 1020, 460, 1200, 330)
  context.lineTo(1200, 800)
  context.lineTo(0, 800)
  context.closePath()
  context.fill()

  context.fillStyle = '#1a2248'
  context.beginPath()
  context.moveTo(0, 642)
  context.bezierCurveTo(160, 520, 315, 650, 465, 540)
  context.bezierCurveTo(665, 395, 790, 640, 960, 505)
  context.bezierCurveTo(1050, 438, 1130, 455, 1200, 412)
  context.lineTo(1200, 800)
  context.lineTo(0, 800)
  context.closePath()
  context.fill()

  context.strokeStyle = '#f9d36f'
  context.lineWidth = 34
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(68, 184)
  context.bezierCurveTo(275, 42, 510, 64, 698, 218)
  context.bezierCurveTo(815, 314, 861, 405, 1036, 423)
  context.stroke()

  context.strokeStyle = '#17204a'
  context.lineWidth = 18
  context.beginPath()
  context.arc(332, 292, 176, 0.2, Math.PI * 1.75)
  context.stroke()

  context.fillStyle = '#f4eee5'
  context.beginPath()
  context.ellipse(608, 422, 115, 190, -0.22, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#f59e58'
  context.beginPath()
  context.ellipse(575, 383, 58, 98, -0.55, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#25214c'
  context.beginPath()
  context.arc(590, 356, 16, 0, Math.PI * 2)
  context.arc(648, 339, 16, 0, Math.PI * 2)
  context.fill()

  context.strokeStyle = '#25214c'
  context.lineWidth = 11
  context.beginPath()
  context.arc(629, 403, 40, 0.15, Math.PI * 0.86)
  context.stroke()

  context.strokeStyle = '#eff6d6'
  context.lineWidth = 15
  context.beginPath()
  context.moveTo(885, 760)
  context.bezierCurveTo(850, 610, 898, 475, 1090, 310)
  context.stroke()

  context.fillStyle = '#ecf6c9'
  const leaves = [
    [870, 645, -0.8], [925, 595, 0.75], [902, 525, -0.7],
    [975, 480, 0.7], [1015, 410, -0.75], [1070, 355, 0.55],
  ]
  for (const [x, y, rotation] of leaves) {
    context.save()
    context.translate(x, y)
    context.rotate(rotation)
    context.beginPath()
    context.ellipse(0, 0, 29, 69, 0, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  context.strokeStyle = '#ffb4d0'
  context.lineWidth = 12
  for (let index = 0; index < 5; index += 1) {
    context.beginPath()
    context.arc(185 + index * 54, 680 - index * 9, 24 + index * 5, 0, Math.PI * 2)
    context.stroke()
  }

  return canvas
}

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

    const artwork = createArtwork()
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artwork)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    let imageAspect = artwork.width / artwork.height
    const image = new Image()
    image.onload = () => {
      imageAspect = image.naturalWidth / image.naturalHeight
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
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
