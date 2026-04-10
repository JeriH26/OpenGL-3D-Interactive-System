// XR Procedural Interior Space
// A virtual room rendered with ray-box intersection.
// Run: ./build/shader_app Shadertoy_Fragment/xr_procedural.frag
// Controls: drag mouse to look around, scroll to change FOV.

uniform vec2  iOrbit;    // yaw (x), pitch (y) from mouse drag
uniform float iDistance; // scroll -> fov factor

// ---------------------------------------------------------------------------
// Noise helpers
// ---------------------------------------------------------------------------
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float vNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash12(i), b = hash12(i+vec2(1,0)),
          c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<4;i++){v+=a*vNoise(p); p*=2.1; p+=vec2(1.7,2.3); a*=0.5;}
    return v;
}

// ---------------------------------------------------------------------------
// Material functions
// ---------------------------------------------------------------------------

// Parquet wood floor: alternating plank grain direction
vec3 woodFloor(vec2 uv) {
    vec2 cell = uv * vec2(2.0, 6.0);
    vec2 id   = floor(cell);
    vec2 cv   = fract(cell);
    float flip = mod(id.x + id.y, 2.0);
    vec2 grain = (flip > 0.5) ? cv.yx : cv;
    float g = sin((grain.x * 5.0 + fbm(grain * vec2(3.0, 0.8)) * 1.8) * 3.14159);
    g = pow(0.5 + 0.5 * g, 1.6);
    // Dark narrow grout lines between planks
    float grout = step(cv.x, 0.04) + step(1.0 - cv.x, 0.04)
                + step(cv.y, 0.03) + step(1.0 - cv.y, 0.03);
    grout = clamp(grout, 0.0, 1.0);
    vec3 col = mix(vec3(0.50, 0.30, 0.14), vec3(0.76, 0.52, 0.27), g);
    return mix(col, vec3(0.22, 0.14, 0.08), grout * 0.6);
}

// Plaster wall with faint texture
vec3 plasterWall(vec2 uv, vec3 baseCol) {
    float tex = fbm(uv * 4.0) * 0.04;
    return baseCol + tex;
}

// Sky through the window (moving clouds)
vec3 windowSky(float wx, float wy) {
    float t = iTime;
    vec3 skyTop    = vec3(0.22, 0.45, 0.78);
    vec3 skyBottom = vec3(0.65, 0.80, 0.95);
    vec3 sky = mix(skyBottom, skyTop, clamp(wy * 1.4, 0.0, 1.0));
    vec2 cp = vec2(wx * 1.5 + t * 0.015, wy * 0.8);
    float cloud = clamp((fbm(cp * 2.5) - 0.38) * 2.5, 0.0, 1.0);
    return mix(sky, vec3(1.0, 0.98, 0.96), cloud * 0.88);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;

    // Camera orientation
    float yaw   = iOrbit.x;
    float pitch = clamp(iOrbit.y, -1.35, 1.35);
    vec3 fwd   = vec3(sin(yaw)*cos(pitch), sin(pitch), cos(yaw)*cos(pitch));
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up    = cross(right, fwd);

    // FOV: iDistance 1->8, scale 1.0->0.35
    float fovScale = mix(1.0, 0.35, clamp((iDistance - 1.0) / 7.0, 0.0, 1.0));
    vec2 ndc = (uv * 2.0 - 1.0) * vec2(aspect, 1.0) * fovScale;
    vec3 rd  = normalize(fwd + ndc.x * right + ndc.y * up);
    vec3 ro  = vec3(0.0, 0.0, 0.0); // camera at room center

    // Room dimensions: X [-3,3], Y [-1.5,1.5], Z [-3,3]
    // Find which wall the ray hits first (ray from inside the box)
    vec3 tExit;
    tExit.x = rd.x > 0.0 ? ( 3.0 - ro.x)/rd.x : (-3.0 - ro.x)/rd.x;
    tExit.y = rd.y > 0.0 ? ( 1.5 - ro.y)/rd.y : (-1.5 - ro.y)/rd.y;
    tExit.z = rd.z > 0.0 ? ( 3.0 - ro.z)/rd.z : (-3.0 - ro.z)/rd.z;

    float t    = min(tExit.x, min(tExit.y, tExit.z));
    vec3  hit  = ro + t * rd;
    float eps  = 0.005;

    vec3 col;
    vec3 norm; // inward-facing normal (toward room center) for lighting

    if (abs(hit.y - 1.5) < eps) {
        // ------ Ceiling ------
        norm = vec3(0.0,-1.0,0.0);
        col  = vec3(0.96, 0.93, 0.89);
        // Central overhead lamp glow
        float d = length(hit.xz) * 0.45;
        col += vec3(1.0, 0.95, 0.80) * exp(-d*d) * 0.30;
        // Plaster subtle texture
        col += (fbm(hit.xz * 3.0) - 0.5) * 0.025;

    } else if (abs(hit.y + 1.5) < eps) {
        // ------ Floor ------
        norm = vec3(0.0, 1.0, 0.0);
        col  = woodFloor(hit.xz * 0.35);
        // Darken floor near walls (fake AO)
        float margin = min(min(3.0 - abs(hit.x), 3.0 - abs(hit.z)), 1.0);
        col *= 0.72 + 0.28 * smoothstep(0.0, 1.0, margin);

    } else if (abs(hit.z - 3.0) < eps) {
        // ------ Front wall — large window ------
        norm = vec3(0.0, 0.0,-1.0);
        float wx = hit.x;  // -3 to 3
        float wy = hit.y;  // -1.5 to 1.5
        // Window opening: 2.6 wide, 1.8 tall, centred slightly high
        bool inWin = abs(wx) < 1.30 && wy > -0.45 && wy < 1.35;
        // Window frame border (6 cm thick)
        bool inFrame = abs(wx) < 1.36 && wy > -0.51 && wy < 1.41 && !inWin;
        if (inWin) {
            float skyX = (wx + 1.30) / 2.60;
            float skyY = (wy + 0.45) / 1.80;
            col = windowSky(skyX, skyY);
        } else if (inFrame) {
            col = vec3(0.91, 0.89, 0.84); // white frame
        } else {
            col = plasterWall(hit.xy * 0.5, vec3(0.89, 0.85, 0.78));
        }

    } else if (abs(hit.z + 3.0) < eps) {
        // ------ Back wall ------
        norm = vec3(0.0, 0.0, 1.0);
        col  = plasterWall(hit.xy * 0.5, vec3(0.86, 0.82, 0.75));
        // Simple bookshelf illusion: horizontal shelves
        float shelf = step(0.0, sin(hit.y * 4.5));
        float bookX = fract(hit.x * 3.0 + hash12(vec2(floor(hit.x*3.0), floor(hit.y*4.5))) * 5.0);
        float book  = step(0.08, bookX) * step(bookX, 0.92) * shelf;
        vec3 bookCol = mix(vec3(0.62,0.22,0.18), vec3(0.22,0.40,0.65),
                          hash12(vec2(floor(hit.x*3.0), floor(hit.y*4.5))));
        col = mix(col, bookCol, book * 0.65);

    } else if (abs(hit.x - 3.0) < eps) {
        // ------ Right wall ------
        norm = vec3(-1.0, 0.0, 0.0);
        col  = plasterWall(hit.zy * 0.5, vec3(0.90, 0.86, 0.80));

    } else {
        // ------ Left wall ------
        norm = vec3( 1.0, 0.0, 0.0);
        col  = plasterWall(hit.zy * 0.5, vec3(0.90, 0.86, 0.80));
    }

    // --------------- Lighting ---------------
    // Point light at ceiling lamp
    vec3 lampPos  = vec3(0.0, 1.35, 0.0);
    vec3 toLight  = lampPos - hit;
    float lDist   = length(toLight);
    vec3  lDir    = toLight / lDist;
    float diffuse = max(dot(norm, lDir), 0.0);
    float atten   = 1.0 / (1.0 + lDist * lDist * 0.18);
    // Window light (direction from +Z, cool colour)
    float winLight= max(dot(norm, vec3(0.0, 0.08,-1.0)), 0.0) * 0.4;

    float ambient = 0.30;
    float light   = ambient + diffuse * atten * 0.85 + winLight;
    col *= clamp(light, 0.0, 1.2);

    // Subtle vignette
    col *= 1.0 - 0.28 * pow(length((uv - 0.5) * vec2(aspect, 1.0)) * 0.9, 2.0);

    fragColor = vec4(clamp(col,0.0,1.0), 1.0);
}
