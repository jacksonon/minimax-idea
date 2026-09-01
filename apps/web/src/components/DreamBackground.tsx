'use client';

/**
 * DreamBackground
 * ----------------
 * A full-viewport, low-opacity three.js scene that drifts behind the
 * landing page. The aesthetic goal is "the dreamer is already dreaming"
 * — a slow, breathing cloud of warm-toned motes and soft ribbons that
 * respond subtly to the cursor. The scene must:
 *   1. Render behind page content (pointer-events: none, fixed)
 *   2. Not block clicks or readability
 *   3. Degrade gracefully (no WebGL → component renders nothing)
 *   4. Respect prefers-reduced-motion (no animation, just static frame)
 *   5. Pause when the tab is hidden (save battery)
 *
 * The implementation is intentionally a single file: one scene, one
 * shader, no framework. See AGENTS.md §3.2 ("one file = one component").
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const PARTICLE_VS = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 color;
  varying vec3 vColor;
  varying float vAlpha;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2 uMouse;
  uniform float uMouseStrength;

  void main() {
    vColor = color;

    // Each particle breathes on its own clock so the field feels alive
    // instead of marching in lockstep.
    float t = uTime * 0.18 + aSeed;
    vec3 p = position;
    p.x += sin(t * 0.7 + aSeed) * 0.6;
    p.y += cos(t * 0.5 + aSeed * 1.3) * 0.4;
    p.z += sin(t * 0.3 + aSeed * 0.7) * 0.3;

    // Cursor repulsion in view space. Strength is damped by 1/(1+d²)
    // so the cloud never rips apart.
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec2 toMouse = mv.xy - uMouse;
    float d = length(toMouse);
    float push = uMouseStrength / (1.0 + d * d * 0.6);
    mv.xy += normalize(toMouse + vec2(0.0001)) * push;

    gl_Position = projectionMatrix * mv;

    // Distance-based size attenuation — far motes shrink so the fog
    // transitions cleanly into the page background.
    float dist = -mv.z;
    gl_PointSize = aSize * uPixelRatio * (8.0 / max(dist, 0.1));

    // Depth-fade + per-particle pulse so the cloud never looks static.
    vAlpha = 0.55 * (1.0 - smoothstep(4.0, 12.0, dist));
    vAlpha *= 0.7 + 0.3 * sin(t * 1.3);
  }
`;

const PARTICLE_FS = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Soft circular sprite: hot center, soft edge falloff.
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    float core = smoothstep(0.5, 0.0, r);
    float glow = smoothstep(0.5, 0.15, r);
    float a = pow(core, 1.6) * 0.85 + glow * 0.25;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export function DreamBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Capability / preference gating -------------------------------------
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Probe WebGL. If it's missing (or the user opts out of motion), we
    // simply render the ambient CSS gradient fallback already on the page.
    const probe = document.createElement('canvas');
    const gl =
      probe.getContext('webgl2') ??
      probe.getContext('webgl') ??
      probe.getContext('experimental-webgl');
    if (!gl || reduceMotion) return;

    // --- Renderer ----------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    // Subtle fog deepens the scene so motes far from the camera dissolve
    // into the page background instead of floating as a hard square.
    // The fog color must match the page bg or far motes read as a hard
    // vignette instead of blending in.
    const isDarkForFog = document.documentElement.classList.contains('dark');
    scene.fog = new THREE.FogExp2(
      isDarkForFog ? 0x0a0a0f : 0xfaf7f2,
      0.06,
    );

    // --- Camera ------------------------------------------------------------
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 8);

    // --- Particles: warm "dream motes" ------------------------------------
    const PARTICLE_COUNT = 900;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const seeds = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    // Theme-aware palette. The light theme uses darker / more saturated
    // colors so motes pop against the cream background; the dark theme
    // uses the existing warm-cream/amber/crimson set.
    const isDark = document.documentElement.classList.contains('dark');
    const PALETTE = isDark
      ? [
          new THREE.Color('#d4a574'), // amber
          new THREE.Color('#8b2635'), // crimson
          new THREE.Color('#f4f1ea'), // cream
        ]
      : [
          new THREE.Color('#b46e32'), // terracotta
          new THREE.Color('#8b2635'), // crimson
          new THREE.Color('#5c8068'), // moss (cool counterpoint)
        ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Flattened ellipsoid so the cloud reads as "ambient" rather than
      // "snow". Y is compressed.
      positions[i * 3 + 0] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14;

      seeds[i] = Math.random() * Math.PI * 2;
      sizes[i] = 4 + Math.random() * 22;

      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]!;
      const jitter = 0.85 + Math.random() * 0.3;
      colors[i * 3 + 0] = c.r * jitter;
      colors[i * 3 + 1] = c.g * jitter;
      colors[i * 3 + 2] = c.b * jitter;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    particleGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseStrength: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Cache uniform refs (typed as non-null) for the animation loop.
    const uTime = particleMat.uniforms.uTime!;
    const uMouse = particleMat.uniforms.uMouse!;
    const uMouseStrength = particleMat.uniforms.uMouseStrength!;

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- Ribbons: thin flowing curves ------------------------------------
    // Three ribbons give the scene a sense of narrative — a thread of
    // dream-logic weaving through the motes. Each is a CatmullRom tube
    // rebuilt every frame from a small set of swaying control points.
    const RIBBON_COUNT = 3;
    const RIBBON_SEGMENTS = 64;
    const ribbons: {
      points: THREE.Vector3[];
      home: THREE.Vector3[];
      mesh: THREE.Mesh;
    }[] = [];

    for (let r = 0; r < RIBBON_COUNT; r++) {
      const pts: THREE.Vector3[] = [];
      const home: THREE.Vector3[] = [];
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Vector3(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6 - 2,
        );
        pts.push(p);
        home.push(p.clone());
      }
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
      const geo = new THREE.TubeGeometry(curve, RIBBON_SEGMENTS, 0.012, 6, false);
      const mat = new THREE.MeshBasicMaterial({
        color: PALETTE[r % PALETTE.length]!,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      ribbons.push({ points: pts, home, mesh });
    }

    // --- Mount the canvas --------------------------------------------------
    const canvas = renderer.domElement;
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    // z-index 0: sit above the body background but below page content.
    canvas.style.zIndex = '0';
    // Theme-aware opacity: more presence on dark, gentler on light so the
    // parchment background still reads as a soft warm canvas.
    canvas.style.opacity = isDark ? '0.9' : '0.7';
    container.appendChild(canvas);

    // --- Sizing ------------------------------------------------------------
    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    resize();
    window.addEventListener('resize', resize);

    // Theme observer: if the user toggles light/dark while the page is
    // open, we don't currently rebuild the scene (acceptable — the
    // canvas is mostly additive, so it still reads OK either way). The
    // initial palette pick is the main fix.

    // --- Cursor tracking --------------------------------------------------
    const target = new THREE.Vector2(0, 0);
    let mouseStrength = 0;
    function onPointerMove(e: PointerEvent) {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = -((e.clientY / window.innerHeight) * 2 - 1);
      mouseStrength = 1.0;
    }
    function onPointerLeave() {
      mouseStrength = 0;
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);

    // --- Animation loop ----------------------------------------------------
    let raf = 0;
    let running = true;
    let lastT = performance.now();

    function animate(now: number) {
      if (!running) return;
      raf = requestAnimationFrame(animate);

      // Tab visibility: pause the loop, don't advance time. Saves battery.
      if (document.hidden) {
        lastT = now;
        return;
      }

      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;

      // Smooth the cursor target so the cloud doesn't jitter.
      uMouse.value.lerp(target, 0.12);
      uMouseStrength.value += (mouseStrength - uMouseStrength.value) * 0.08;
      uTime.value += dt;

      // Slowly drift the whole particle cloud, like wind.
      particles.rotation.y += dt * 0.02;
      particles.rotation.x = Math.sin(now * 0.0001) * 0.05;

      // Re-shape each ribbon: each control point sways on its own phase.
      for (let r = 0; r < ribbons.length; r++) {
        const ribbon = ribbons[r]!;
        for (let i = 0; i < ribbon.points.length; i++) {
          const home = ribbon.home[i]!;
          const phase = i * 0.7 + r * 1.3;
          ribbon.points[i]!.set(
            home.x + Math.sin(now * 0.0004 + phase) * 1.4,
            home.y + Math.cos(now * 0.0005 + phase * 1.2) * 0.8,
            home.z + Math.sin(now * 0.0003 + phase * 0.8) * 0.5,
          );
        }
        const newCurve = new THREE.CatmullRomCurve3(
          ribbon.points,
          false,
          'catmullrom',
          0.5,
        );
        const newGeo = new THREE.TubeGeometry(
          newCurve,
          RIBBON_SEGMENTS,
          0.012,
          6,
          false,
        );
        ribbon.mesh.geometry.dispose();
        ribbon.mesh.geometry = newGeo;
      }

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(animate);

    // --- Cleanup ----------------------------------------------------------
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);

      particleGeo.dispose();
      particleMat.dispose();
      ribbons.forEach((r) => {
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
      });
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return <div ref={containerRef} aria-hidden="true" />;
}