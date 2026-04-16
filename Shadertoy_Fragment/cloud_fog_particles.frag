// Black background with a central sky-cloud blob, idly moving.
// Shadertoy style entry: mainImage(out vec4, in vec2).
uniform float iDistance; // host zoom distance, controlled by mouse wheel

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.7, 1.1, -1.1, 1.7);
    for (int i = 0; i < 5; ++i) {
        v += a * valueNoise(p);
        p = m * p;
        a *= 0.5;
    }
    return v;
}

// Debug mode controlled by host UI buttons:
// 0 = default fbm cloud texture
// 1 = single-layer valueNoise texture (flatter, less detail)
// 2 = visualize texture as grayscale (for comparison)

float rectMask(vec2 uv, vec2 mn, vec2 mx) {
    vec2 inBox = step(mn, uv) * step(uv, mx);
    return inBox.x * inBox.y;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 p = (fragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float t = iTime;
    float r = length(p);

    // Use near-black background so edge alpha falloff does not look like a harsh black halo.
    vec3 col = vec3(0.014, 0.018, 0.028);

    // Sky palette used only inside cloud body (not full screen).
    vec3 skyTop = vec3(0.20, 0.42, 0.72);
    vec3 skyMid = vec3(0.42, 0.64, 0.86);
    vec3 skyBottom = vec3(0.68, 0.82, 0.94);
    float h = smoothstep(0.0, 1.0, uv.y);
    vec3 skyColor = mix(mix(skyBottom, skyMid, smoothstep(0.0, 0.60, h)), skyTop, smoothstep(0.45, 1.0, h));

    // Slow idle motion for the cloud mass.
    vec2 center = vec2(0.09 * sin(t * 0.22), 0.06 * sin(t * 0.17 + 1.4));
    vec2 q = p - center;
    float rq = length(q);
    float angQ = atan(q.y, q.x);
    vec2 dirQ = vec2(cos(angQ), sin(angQ));

    // Irregular spherical cloud boundary.
    float boundaryNoiseA = fbm(q * 3.4 + vec2(t * 0.04, -t * 0.03));
    float boundaryNoiseB = fbm(vec2(dirQ.x * 1.4 + dirQ.y * 0.9, rq * 4.2 - t * 0.02));
    float edgeWarp = (boundaryNoiseA - 0.5) * 0.13 + (boundaryNoiseB - 0.5) * 0.07;

    // Map camera distance [1.2, 8.0] -> cloud size scale [1.55, 0.55].
    float zoom01 = clamp((iDistance - 1.2) / (8.0 - 1.2), 0.0, 1.0);
    float sizeScale = mix(1.55, 0.55, zoom01);
    float blobRadius = 0.46 * sizeScale;
    float blobMask = smoothstep(blobRadius + 0.07, blobRadius - 0.07, rq + edgeWarp);

    // Cloud texture inside blob.
    vec2 cloudUv = q * 1.8 + vec2(t * 0.02, -t * 0.01);
    float cloudTex;
    if (iNoiseMode == 1) {
        // Single octave only: useful to see how much detail fbm contributes.
        cloudTex = valueNoise(cloudUv * 2.6);
    } else {
        float c1 = fbm(cloudUv * 2.6);
        float c2 = fbm(cloudUv * 5.0 + 7.1);
        cloudTex = mix(c1, c2, 0.45);
    }

    if (iNoiseMode == 2) {
        fragColor = vec4(vec3(cloudTex), 1.0);
        return;
    }

    float cloudMask = smoothstep(0.46, 0.70, cloudTex);

    vec3 cloudCol = vec3(0.82, 0.88, 0.94);
    vec3 blobCol = mix(skyColor, cloudCol, cloudMask * 0.92);

    // Gentle fog edge aligned with warped boundary to avoid seam/halo mismatch.
    float warpedR = rq + edgeWarp;
    float fogEdge = smoothstep(blobRadius + 0.28, blobRadius - 0.06, warpedR);
    blobCol = mix(blobCol, vec3(0.72, 0.79, 0.88), fogEdge * 0.06);

    // Sun reflection: sun-facing half of cloud is warmer and brighter.
    vec2 sunDir = normalize(vec2(0.55, 0.70));
    vec3 sunColor = vec3(1.00, 0.93, 0.68);
    float sunFacing = dot(q / max(blobRadius, 0.001), sunDir); // -1..1, sun side = positive
    float sunGlow = smoothstep(-0.1, 0.9, sunFacing) * cloudMask;
    blobCol += sunColor * sunGlow * 0.14;

    // Compose with softened edge alpha to avoid double-darkening near boundary.
    float edgeAlpha = smoothstep(0.06, 0.98, blobMask);
    col = mix(col, blobCol, edgeAlpha);

    // Silver lining: subtle sun-facing rim glow at the cloud boundary.
    float edgePct = smoothstep(blobRadius - 0.06, blobRadius + 0.06, warpedR);
    float silverRim = edgePct * (1.0 - edgePct) * 4.0;
    silverRim *= pow(max(dot(normalize(q + vec2(1e-4)), sunDir), 0.0), 1.5);
    col += sunColor * silverRim * 0.18;

    float vignette = smoothstep(1.25, 0.20, r);
    col *= 0.90 + 0.10 * vignette;

    // Debug buttons (top-left): 0 / 1 / 2 with active highlight.
    vec2 panel = vec2(0.018, 0.926);
    vec2 size = vec2(0.070, 0.052);
    float gap = 0.010;

    vec3 base = vec3(0.10, 0.12, 0.15);
    vec3 on0 = vec3(0.12, 0.52, 0.20);
    vec3 on1 = vec3(0.65, 0.47, 0.10);
    vec3 on2 = vec3(0.56, 0.22, 0.18);

    for (int i = 0; i < 3; ++i) {
        vec2 mn = panel + vec2(float(i) * (size.x + gap), 0.0);
        vec2 mx = mn + size;
        float box = rectMask(uv, mn, mx);
        if (box > 0.0) {
            vec3 fill = base;
            if (iNoiseMode == i) fill = (i == 0) ? on0 : ((i == 1) ? on1 : on2);

            // Inner border and simple glyph bars as lightweight labels.
            vec2 luv = (uv - mn) / size;
            float border = step(luv.x, 0.04) + step(0.96, luv.x) + step(luv.y, 0.06) + step(0.94, luv.y);
            border = min(border, 1.0);

            float g0 = step(0.22, luv.x) * step(luv.x, 0.78) * step(0.25, luv.y) * step(luv.y, 0.75)
                     - step(0.30, luv.x) * step(luv.x, 0.70) * step(0.35, luv.y) * step(luv.y, 0.65);
            float g1 = step(0.46, luv.x) * step(luv.x, 0.56) * step(0.24, luv.y) * step(luv.y, 0.76);
            float g2a = step(0.22, luv.x) * step(luv.x, 0.78) * step(0.62, luv.y) * step(luv.y, 0.74);
            float g2b = step(0.22, luv.x) * step(luv.x, 0.78) * step(0.26, luv.y) * step(luv.y, 0.38);
            float g2c = step(0.64, luv.x) * step(luv.x, 0.78) * step(0.38, luv.y) * step(luv.y, 0.62);
            float g2d = step(0.22, luv.x) * step(luv.x, 0.36) * step(0.38, luv.y) * step(luv.y, 0.50);

            float glyph = (i == 0) ? g0 : ((i == 1) ? g1 : (g2a + g2b + g2c + g2d));
            vec3 txt = vec3(0.92);

            vec3 buttonCol = mix(fill, vec3(0.03), border * 0.9);
            buttonCol = mix(buttonCol, txt, clamp(glyph, 0.0, 1.0));
            col = mix(col, buttonCol, box * 0.95);
        }
    }

    fragColor = vec4(col, 1.0);
}
