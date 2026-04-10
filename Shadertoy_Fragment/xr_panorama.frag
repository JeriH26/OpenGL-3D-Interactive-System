// XR 360° Equirectangular Panorama Viewer
// Run with a panorama image:
//   ./build/xr_viewer Shadertoy_Fragment/xr_panorama.frag --image your_panorama.jpg
// Without an image it shows a procedural sky panorama.
// Controls: drag mouse to look around | scroll to zoom.

uniform sampler2D iChannel0;  // equirectangular panorama
uniform float     iHasTexture; // 1.0 if image loaded, 0.0 otherwise
uniform vec2      iOrbit;      // yaw (x), pitch (y)
uniform float     iDistance;   // scroll zoom

const float PI = 3.14159265359;

// ---------------------------------------------------------------------------
// Procedural sky fallback (shown when no image is loaded)
// ---------------------------------------------------------------------------
float hash12_p(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float vNoise_p(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a=hash12_p(i), b=hash12_p(i+vec2(1,0)), c=hash12_p(i+vec2(0,1)), d=hash12_p(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm_p(vec2 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){v+=a*vNoise_p(p); p*=2.1; p+=vec2(3.1,1.7); a*=0.5;}
    return v;
}

vec3 proceduralPanorama(vec3 dir) {
    float t = iTime;
    // Sky gradient
    vec3 skyHorizon = vec3(0.68, 0.82, 0.96);
    vec3 skyZenith  = vec3(0.16, 0.38, 0.72);
    vec3 skyGround  = vec3(0.35, 0.30, 0.26);
    float up = dir.y;
    vec3 sky = up > 0.0
        ? mix(skyHorizon, skyZenith, pow(up, 0.5))
        : mix(skyHorizon, skyGround, pow(-up, 0.4));

    if (dir.y > -0.05) {
        // Clouds on upper hemisphere
        vec2 cp = dir.xz / max(dir.y + 0.08, 0.08) * 0.6 + vec2(t * 0.012, 0.0);
        float cloud = clamp((fbm_p(cp * 2.2) - 0.36) * 2.8, 0.0, 1.0);
        cloud *= smoothstep(-0.05, 0.15, dir.y); // fade at horizon
        sky = mix(sky, vec3(1.0, 0.98, 0.95), cloud * 0.90);
    }

    // Sun disc
    vec3 sunDir = normalize(vec3(0.6, 0.35, 0.7));
    float sun = pow(max(dot(dir, sunDir), 0.0), 380.0);
    float sunGlow = pow(max(dot(dir, sunDir), 0.0), 12.0) * 0.25;
    sky += vec3(1.0, 0.95, 0.70) * (sun + sunGlow);

    return sky;
}

// ---------------------------------------------------------------------------
// Equirectangular UV from ray direction
// ---------------------------------------------------------------------------
vec2 equiUV(vec3 dir) {
    float lon = atan(dir.x, -dir.z);        // -PI .. PI
    float lat = asin(clamp(dir.y, -1.0, 1.0)); // -PI/2 .. PI/2
    return vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv     = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;

    // FOV: scroll zoom (close = wide view, far = telephoto)
    float fov = mix(1.10, 0.30, clamp((iDistance - 1.0) / 7.0, 0.0, 1.0));

    vec2 ndc = (uv * 2.0 - 1.0) * vec2(aspect, 1.0) * fov;
    vec3 ray = normalize(vec3(ndc.x, ndc.y, -1.0));

    // Apply pitch (around X axis)
    float pitch = -iOrbit.y;
    float cp = cos(pitch), sp = sin(pitch);
    ray = vec3(ray.x, cp*ray.y - sp*ray.z, sp*ray.y + cp*ray.z);

    // Apply yaw (around Y axis)
    float yaw = iOrbit.x;
    float cy = cos(yaw), sy = sin(yaw);
    ray = vec3(cy*ray.x + sy*ray.z, ray.y, -sy*ray.x + cy*ray.z);

    vec3 col;
    if (iHasTexture > 0.5) {
        // Sample equirectangular panorama with slight chromatic aberration
        vec2 eqUV = equiUV(ray);
        float aberr = length(ndc) * length(ndc) * 0.004;
        col.r = texture(iChannel0, eqUV + vec2( aberr, 0.0)).r;
        col.g = texture(iChannel0, eqUV                   ).g;
        col.b = texture(iChannel0, eqUV - vec2( aberr, 0.0)).b;
    } else {
        // Procedural sky
        col = proceduralPanorama(ray);
    }

    // Lens vignette
    float vig = 1.0 - 0.35 * pow(length((uv - 0.5) * vec2(aspect, 1.0)) * 0.85, 2.0);
    col *= vig;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
