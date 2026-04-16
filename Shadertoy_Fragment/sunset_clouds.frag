// Sunset-tinted clouds: mostly daytime blue sky,
// gentle warm glow at horizon, golden rim on cloud edges.
// Run: ./build/shader_app Shadertoy_Fragment/sunset_clouds.frag
uniform float iDistance;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash12(i),              b = hash12(i + vec2(1,0)),
          c = hash12(i + vec2(0,1)),  d = hash12(i + vec2(1,1));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.7, 1.1, -1.1, 1.7);
    for (int i = 0; i < 5; ++i) { v += a * valueNoise(p); p = m * p; a *= 0.5; }
    return v;
}

float cloudField(vec2 uv, float t) {
    // Two cloud layers with different drift/sizes to avoid a single fake blob.
    vec2 p1 = uv * vec2(1.9, 1.15) + vec2(t * 0.010, -t * 0.003);
    vec2 p2 = uv * vec2(3.1, 1.65) + vec2(-t * 0.016, t * 0.005) + vec2(7.3, 2.1);

    float n1 = mix(fbm(p1 * 2.2), fbm(p1 * 4.6 + 3.7), 0.45);
    float n2 = fbm(p2 * 2.9);

    float base = smoothstep(0.50, 0.74, n1);
    float wisps = smoothstep(0.60, 0.84, n2) * 0.48;

    // Cloud belt: denser around middle, thinner near top and bottom.
    float belt = smoothstep(0.03, 0.34, uv.y) * smoothstep(1.02, 0.30, uv.y);
    return clamp((base + wisps) * belt, 0.0, 1.0);
}

vec3 skyGradient(vec2 uv) {
    vec3 zenith = vec3(0.13, 0.33, 0.66);
    vec3 midSky = vec3(0.36, 0.58, 0.84);
    vec3 lowSky = vec3(0.71, 0.84, 0.95);
    vec3 warmHz = vec3(0.95, 0.68, 0.36);

    vec3 sky = mix(zenith, midSky, smoothstep(1.0, 0.58, uv.y));
    sky = mix(sky, lowSky, smoothstep(0.58, 0.14, uv.y));
    sky = mix(sky, warmHz, smoothstep(0.20, 0.0, uv.y) * 0.42);
    return sky;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord.xy / iResolution.xy;
    float t = iTime;
    float asp = iResolution.x / iResolution.y;

    vec2 sunDir = normalize(vec2(0.62, 0.78));
    vec2 sunPos = vec2(0.80, 0.16);
    vec3 sunWarm = vec3(1.0, 0.80, 0.50);

    // Base sky plus soft sun glow (no hard sun disc).
    vec3 sky = skyGradient(uv);
    vec2 dSun = (uv - sunPos) * vec2(asp, 1.25);
    float sunGlow = exp(-length(dSun) * 5.2);
    sky += sunWarm * sunGlow * 0.18;

    // Cloud density: far layer + near layer for depth.
    float densFar  = cloudField(uv * vec2(0.92, 0.95) + vec2(0.03, 0.05), t * 0.78) * 0.86;
    float densNear = cloudField(uv * vec2(1.12, 1.04) + vec2(-0.02, -0.01), t * 1.18);
    float dens     = max(densFar, densNear);

    float densToSunFar  = cloudField((uv + sunDir * 0.028) * vec2(0.92, 0.95) + vec2(0.03, 0.05), t * 0.78) * 0.86;
    float densToSunNear = cloudField((uv + sunDir * 0.028) * vec2(1.12, 1.04) + vec2(-0.02, -0.01), t * 1.18);
    float densToSun     = max(densToSunFar, densToSunNear);

    float densBackFar   = cloudField((uv - sunDir * 0.020) * vec2(0.92, 0.95) + vec2(0.03, 0.05), t * 0.78) * 0.86;
    float densBackNear  = cloudField((uv - sunDir * 0.020) * vec2(1.12, 1.04) + vec2(-0.02, -0.01), t * 1.18);
    float densBack      = max(densBackFar, densBackNear);

    // Sky is dimmed where clouds occlude sunlight, and slightly warmed by scattering.
    sky *= 1.0 - densBack * 0.16;
    sky += sunWarm * densBack * 0.055;

    // Cloud colors: far layer warmer, near layer cooler.
    float sunVisFar  = 1.0 - densToSunFar;
    float sunVisNear = 1.0 - densToSunNear;
    float horizonWarm = smoothstep(0.22, 0.0, uv.y);

    vec3 farShd = vec3(0.79, 0.82, 0.89);
    vec3 farLit = vec3(0.97, 0.90, 0.80);
    vec3 nearShd = vec3(0.70, 0.80, 0.93);
    vec3 nearLit = vec3(0.92, 0.96, 0.99);

    vec3 cloudFar = mix(farShd, farLit, smoothstep(0.18, 0.95, sunVisFar));
    vec3 cloudNear = mix(nearShd, nearLit, smoothstep(0.18, 0.95, sunVisNear));

    // Bidirectional coupling: sky tints clouds, clouds tint and dim sky.
    cloudFar = mix(cloudFar, sky, 0.18);
    cloudNear = mix(cloudNear, sky, 0.28);
    cloudFar += sunWarm * horizonWarm * sunVisFar * 0.18;
    cloudNear += sunWarm * horizonWarm * sunVisNear * 0.08;

    // Thin edges pick up sunset scattering softly.
    float thinFar = smoothstep(0.08, 0.42, densFar) * (1.0 - smoothstep(0.46, 0.88, densFar));
    float thinNear = smoothstep(0.08, 0.42, densNear) * (1.0 - smoothstep(0.46, 0.88, densNear));
    cloudFar += sunWarm * thinFar * sunVisFar * 0.13;
    cloudNear += sunWarm * thinNear * sunVisNear * 0.08;

    // Final compose in depth order: far first, near second.
    float alphaFar = smoothstep(0.08, 0.66, densFar) * 0.78;
    float alphaNear = smoothstep(0.10, 0.72, densNear) * 0.92;
    vec3 col = mix(sky, cloudFar, alphaFar);
    col = mix(col, cloudNear, alphaNear);

    // Very mild vignette for focus only.
    vec2 vp = (uv - 0.5) * vec2(asp, 1.0);
    col *= 1.0 - dot(vp, vp) * 0.08;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
