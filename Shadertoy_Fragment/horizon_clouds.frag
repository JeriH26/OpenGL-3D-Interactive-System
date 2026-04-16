// horizon_clouds.frag
// 2D side-view sunset sky. Camera is at ground looking toward the horizon.
// Clouds have a flat base and bumpy tops — their HEIGHT gives them visible thickness.
// Lighting: bright top (sky), dark shadowed core, warm amber base (sunset bounce).
// The warm sunset glow is in the BACKGROUND sky; clouds reflect it at their edges.
//
// Run:   ./build/shader_app Shadertoy_Fragment/horizon_clouds.frag
// Scroll: moves horizon line up / down

uniform float iDistance;

// ── Noise ────────────────────────────────────────────────────────────────────
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm5(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.7, 1.1, -1.1, 1.7);
    for (int i = 0; i < 5; i++) { v += a * valueNoise(p); p = m * p; a *= 0.5; }
    return v;
}
float fbm3(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.7, 1.1, -1.1, 1.7);
    for (int i = 0; i < 3; i++) { v += a * valueNoise(p); p = m * p; a *= 0.5; }
    return v;
}

// ── Cloud silhouette ──────────────────────────────────────────────────────────
// For each screen-x column, how tall is the cloud?
// Returns density [0,1] and writes h = vertical fraction within cloud (0=base, 1=top).
float cloudDensity(vec2 uv, float t, out float h) {
    h = 0.0;
    float cloudBase = 0.36;   // flat cloud base as fraction of screen height

    if (uv.y < cloudBase - 0.01) return 0.0;

    // Large-scale cloud groups / gaps (only depends on x, not y → uniform silhouette)
    float presence  = fbm5(vec2(uv.x * 1.9 + t * 0.012, 0.20));
    float cloudAmt  = smoothstep(0.40, 0.58, presence);
    if (cloudAmt < 0.01) return 0.0;

    // Per-column cloud top height: taller where more cloudAmt, has bumps
    float topShape  = fbm5(vec2(uv.x * 2.6 + t * 0.009, 3.10));
    float cloudTop  = cloudBase + cloudAmt * (0.07 + topShape * 0.34);

    if (uv.y > cloudTop) return 0.0;

    // Vertical fraction 0=base, 1=top
    h = clamp((uv.y - cloudBase) / max(cloudTop - cloudBase, 0.001), 0.0, 1.0);

    // Internal puffiness: lighter and darker patches within body
    float interior = fbm3(vec2(uv.x * 4.8 + t * 0.016, uv.y * 2.5 + 0.5));

    // Vertical envelope: sharp horizontal base, soft rounded top
    float vEnv = smoothstep(0.0, 0.08, h) * smoothstep(1.0, 0.75, h);

    return clamp(cloudAmt * vEnv * smoothstep(0.28, 0.50, interior), 0.0, 1.0);
}

// ── Sky background — no ground, no sun disc, smooth warm glow at bottom ───────
vec3 skyBg(vec2 uv) {
    // y=1 deep blue zenith, y=0 warm peach/amber horizon glow
    vec3 zenith  = vec3(0.08, 0.22, 0.58);
    vec3 midBlue = vec3(0.22, 0.44, 0.78);
    vec3 paleBlu = vec3(0.58, 0.72, 0.90);
    vec3 warmHrz = vec3(0.88, 0.62, 0.28);  // warm peach at horizon level
    vec3 deepWrm = vec3(0.72, 0.38, 0.12);  // deeper amber at very bottom

    // Smooth continuous gradient top→bottom, no branches, no hard edge
    vec3 sky = zenith;
    sky = mix(sky, midBlue, smoothstep(1.0, 0.55, uv.y));
    sky = mix(sky, paleBlu, smoothstep(0.55, 0.30, uv.y));
    sky = mix(sky, warmHrz, smoothstep(0.30, 0.10, uv.y));
    sky = mix(sky, deepWrm, smoothstep(0.10, 0.0,  uv.y));
    return sky;
}

// ── Main ─────────────────────────────────────────────────────────────────────
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2  uv  = fragCoord / iResolution.xy;   // y: 0 = bottom, 1 = top
    float asp = iResolution.x / iResolution.y;
    float t   = iTime;

    // ── Background: smooth all-sky gradient ──
    vec3 col = skyBg(uv);

    // ── Clouds ──
    float h;
    float dens = cloudDensity(uv, t, h);

    if (dens > 0.01) {
        // Cloud color from vertical position (h=0 base, h=1 top):
        //   base: warm amber/peach — sunset glow from below shines up into cloud base
        //   core: cool dark grey   — interior shadow, light doesn't penetrate
        //   top : bright white/silver — open sky above lights the top
        vec3 cBase = vec3(0.78, 0.58, 0.32);  // warm peach-amber (horizon glow reflected)
        vec3 cCore = vec3(0.32, 0.33, 0.40);  // dark grey interior shadow
        vec3 cMid  = vec3(0.62, 0.63, 0.70);  // lighter upper body
        vec3 cTop  = vec3(0.90, 0.89, 0.90);  // bright silver top

        float h2 = h * h;
        vec3 cCloud = mix(cBase,
                      mix(cCore,
                      mix(cMid, cTop,
                          smoothstep(0.55, 1.0, h)),
                          smoothstep(0.22, 0.58, h)),
                          smoothstep(0.0,  0.20, h));

        // Subtle warm rim at very top edges (background sunset glow bleeding around)
        float rim = smoothstep(0.78, 1.0, h);
        cCloud = mix(cCloud, vec3(0.95, 0.82, 0.55), rim * 0.30);

        // Thin edges are translucent — background sky/glow bleeds through
        col = mix(col, cCloud, smoothstep(0.0, 0.35, dens));
    }

    // Vignette
    vec2 vp = (uv - 0.5) * vec2(asp, 1.0);
    col *= 1.0 - 0.22 * dot(vp, vp) * 2.2;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
