// XR Spatial Stereo Viewer
// Left half = left eye, right half = right eye.
// A slight yaw offset between eyes simulates inter-pupillary distance (IPD).
// Run with a panorama:
//   ./build/xr_viewer Shadertoy_Fragment/xr_stereo.frag --image your_panorama.jpg
// Without an image shows a procedural sky in stereo.
// Controls: drag mouse to look around | scroll to zoom.

uniform sampler2D iChannel0;   // equirectangular panorama
uniform float     iHasTexture; // 1.0 if image loaded
uniform vec2      iOrbit;      // yaw, pitch
uniform float     iDistance;

const float PI = 3.14159265359;
// IPD expressed as yaw angle offset (approx 6.5 cm / 1 m viewing = ~3.7°)
const float IPD_ANGLE = 0.032;

// ---------------------------------------------------------------------------
// Procedural sky (same as xr_panorama fallback)
// ---------------------------------------------------------------------------
float hash12_s(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float vNoise_s(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a=hash12_s(i), b=hash12_s(i+vec2(1,0)), c=hash12_s(i+vec2(0,1)), d=hash12_s(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm_s(vec2 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){v+=a*vNoise_s(p); p*=2.1; p+=vec2(1.3,2.9); a*=0.5;}
    return v;
}
vec3 proceduralSky(vec3 dir) {
    float t = iTime;
    vec3 sky = mix(vec3(0.66,0.82,0.96), vec3(0.16,0.38,0.72),
                   clamp(pow(max(dir.y, 0.0), 0.45), 0.0, 1.0));
    if (dir.y < 0.0) sky = mix(sky, vec3(0.33,0.28,0.24), pow(min(-dir.y,1.0), 0.4));
    if (dir.y > -0.05) {
        vec2 cp = dir.xz / max(dir.y + 0.08, 0.08) * 0.6 + vec2(t * 0.012, 0.0);
        float cloud = clamp((fbm_s(cp * 2.2) - 0.36) * 2.8, 0.0, 1.0);
        cloud *= smoothstep(-0.05, 0.20, dir.y);
        sky = mix(sky, vec3(1.0, 0.98, 0.95), cloud * 0.88);
    }
    vec3 sunDir = normalize(vec3(0.6,0.35,0.7));
    sky += vec3(1.0,0.95,0.70) * (pow(max(dot(dir,sunDir),0.0),380.0)
                                 + pow(max(dot(dir,sunDir),0.0),10.0)*0.22);
    return sky;
}

// ---------------------------------------------------------------------------
// Render one eye given a per-eye UV in [0,1]x[0,1] and a yaw offset
// ---------------------------------------------------------------------------
vec3 renderEye(vec2 eyeUV, float yawOffset) {
    float aspect = (iResolution.x * 0.5) / iResolution.y; // half-panel aspect
    float fov = mix(1.05, 0.28, clamp((iDistance - 1.0) / 7.0, 0.0, 1.0));

    vec2 ndc = (eyeUV * 2.0 - 1.0) * vec2(aspect, 1.0) * fov;

    // Barrel distortion (compensates VR lens pincushion)
    float r2 = dot(ndc, ndc);
    ndc *= 1.0 + r2 * 0.10 + r2 * r2 * 0.03;

    vec3 ray = normalize(vec3(ndc.x, ndc.y, -1.0));

    // Pitch rotation
    float pitch = -iOrbit.y;
    float cp = cos(pitch), sp = sin(pitch);
    ray = vec3(ray.x, cp*ray.y - sp*ray.z, sp*ray.y + cp*ray.z);

    // Yaw rotation (include eye IPD offset)
    float yaw = iOrbit.x + yawOffset;
    float cy = cos(yaw), sy = sin(yaw);
    ray = vec3(cy*ray.x + sy*ray.z, ray.y, -sy*ray.x + cy*ray.z);

    vec3 col;
    if (iHasTexture > 0.5) {
        float lon = atan(ray.x, -ray.z);
        float lat = asin(clamp(ray.y, -1.0, 1.0));
        vec2 eqUV = vec2(lon / (2.0*PI) + 0.5, lat / PI + 0.5);
        // Chromatic aberration per eye
        float aberr = r2 * 0.005;
        col.r = texture(iChannel0, eqUV + vec2( aberr, 0.0)).r;
        col.g = texture(iChannel0, eqUV).g;
        col.b = texture(iChannel0, eqUV - vec2( aberr, 0.0)).b;
    } else {
        col = proceduralSky(ray);
    }

    // Per-eye vignette (stronger at edges for immersion)
    float vig = 1.0 - 0.55 * pow(length(eyeUV - 0.5) * 1.6, 2.5);
    col *= max(vig, 0.0);

    return col;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // Determine which eye and compute per-eye UV
    bool isLeft = uv.x < 0.5;
    vec2 eyeUV  = isLeft
        ? vec2(uv.x * 2.0,       uv.y)
        : vec2((uv.x - 0.5)*2.0, uv.y);
    float yawOff = isLeft ? -IPD_ANGLE : IPD_ANGLE;

    vec3 col = renderEye(eyeUV, yawOff);

    // Thin centre divider
    float div = smoothstep(0.003, 0.0, abs(uv.x - 0.5));
    col = mix(col, vec3(0.0), div);

    // Subtle scan-line overlay for XR feel
    float scan = 0.97 + 0.03 * sin(fragCoord.y * 3.14159 * 2.0);
    col *= scan;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
