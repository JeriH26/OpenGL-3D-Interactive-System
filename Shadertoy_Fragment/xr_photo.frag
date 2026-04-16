// XR Normal Photo Viewer
// A single photo displayed as a floating panel in virtual space.
// Mirrors the Vision Pro experience: photo hangs in front of you,
// you can look around it, the environment continues behind it.
//
// Run:
//   ./build/xr_viewer Shadertoy_Fragment/xr_photo.frag --image your_photo.jpg
// Without image: shows a placeholder grid panel.
// Controls: drag mouse to look around | scroll to zoom.

uniform sampler2D iChannel0;
uniform float     iHasTexture;
uniform vec2      iOrbit;
uniform float     iDistance;

// ---------------------------------------------------------------------------
// Background environment: a simple dim lounge-like room
// ---------------------------------------------------------------------------
vec3 background(vec3 rd) {
    // Ambient gradient: dark grey at sides, slightly warmer up top
    vec3 ambient = mix(vec3(0.08, 0.08, 0.10), vec3(0.18, 0.16, 0.14),
                       clamp(rd.y * 0.5 + 0.5, 0.0, 1.0));

    // Soft ceiling light bloom
    float ceilBloom = exp(-max(1.0 - rd.y, 0.0) * 4.5) * 0.18;
    ambient += vec3(0.95, 0.90, 0.80) * ceilBloom;

    // Floor reflection: fake specular from below
    float floorBloom = exp(-max(rd.y + 0.12, 0.0) * 8.0) * 0.10;
    ambient += vec3(0.60, 0.65, 0.70) * floorBloom;

    return ambient;
}

// ---------------------------------------------------------------------------
// Photo panel geometry
// Panel centre at (0, 0, -PANEL_Z), 16:9, PANEL_W wide.
// ---------------------------------------------------------------------------
const float PANEL_Z = 2.0;         // distance in front of camera
const float PANEL_W = 1.80;        // width  (world units)
const float PANEL_H = 1.01;        // height (≈ 16:9)
const float FRAME   = 0.035;       // frame border width

// Drop-shadow softness around the panel
float panelShadow(vec2 panelPos) {
    // panelPos: distance outside the panel in each axis (negative = inside)
    vec2 d = abs(panelPos) - vec2(PANEL_W * 0.5 + 0.12, PANEL_H * 0.5 + 0.12);
    return exp(-max(length(max(d, 0.0)) * 6.0, 0.0));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv   = fragCoord / iResolution.xy;
    float asp = iResolution.x / iResolution.y;

    // Build camera ray (same as xr_panorama)
    float fov = mix(1.0, 0.3, clamp((iDistance - 1.0) / 7.0, 0.0, 1.0));
    vec2 ndc  = (uv * 2.0 - 1.0) * vec2(asp, 1.0) * fov;
    vec3 rd   = normalize(vec3(ndc.x, ndc.y, -1.0));

    // Pitch
    float pitch = -iOrbit.y;
    float cp = cos(pitch), sp = sin(pitch);
    rd = vec3(rd.x, cp*rd.y - sp*rd.z, sp*rd.y + cp*rd.z);

    // Yaw
    float yaw = iOrbit.x;
    float cy = cos(yaw), sy = sin(yaw);
    rd = vec3(cy*rd.x + sy*rd.z, rd.y, -sy*rd.x + cy*rd.z);

    // ------------------------------------------------------------------
    // Ray–plane intersection at z = -PANEL_Z
    // The panel is always at world position (0, 0, -PANEL_Z).
    // Camera is at origin.
    // ------------------------------------------------------------------
    vec3 col;

    // Only intersect front-facing rays (rd.z < 0)
    if (rd.z < -0.0001) {
        float t = -PANEL_Z / rd.z;                  // parametric distance
        vec2 hit = vec2(rd.x, rd.y) * t;            // XY at intersection

        // Is the hit inside the panel?
        bool inPanel = abs(hit.x) < PANEL_W * 0.5
                    && abs(hit.y) < PANEL_H * 0.5;

        // Is the hit inside the frame band?
        bool inFrame = abs(hit.x) < PANEL_W * 0.5 + FRAME
                    && abs(hit.y) < PANEL_H * 0.5 + FRAME
                    && !inPanel;

        if (inPanel) {
            // ------ Photo area ------
            // Convert hit position to UV [0,1]
            vec2 photoUV = vec2(
                hit.x / PANEL_W + 0.5,
                hit.y / PANEL_H + 0.5
            );

            if (iHasTexture > 0.5) {
                col = texture(iChannel0, photoUV).rgb;

                // Very subtle vignette on photo edges
                vec2 vd = abs(photoUV - 0.5) * 2.0;
                float vig = 1.0 - 0.12 * pow(max(vd.x, vd.y), 3.0);
                col *= vig;
            } else {
                // Placeholder: a light grey grid panel
                vec2 grid = fract(photoUV * 8.0);
                float line = step(grid.x, 0.05) + step(grid.y, 0.05);
                col = mix(vec3(0.78, 0.78, 0.78), vec3(0.60, 0.60, 0.60),
                          clamp(line, 0.0, 1.0));
                // "No image" text hint: cross pattern in centre
                vec2 cen = abs(photoUV - 0.5);
                float cross = step(cen.x, 0.02) * step(cen.y, 0.18)
                            + step(cen.y, 0.02) * step(cen.x, 0.18);
                col = mix(col, vec3(0.45), clamp(cross, 0.0, 1.0));
            }

        } else if (inFrame) {
            // ------ White frame border ------
            // Slight bevel: inner edge slightly darker
            vec2 innerDist = vec2(PANEL_W * 0.5, PANEL_H * 0.5) - abs(hit);
            float bevel = clamp(min(innerDist.x, innerDist.y) / FRAME, 0.0, 1.0);
            col = mix(vec3(0.72, 0.70, 0.68), vec3(0.96, 0.94, 0.91), bevel);

        } else {
            // ------ Background (with drop shadow) ------
            col = background(rd);
            float shadow = panelShadow(hit) * 0.55;
            col = mix(col, vec3(0.0), shadow);
        }

        // Ambient occlusion darkening near edges of panel (depth cue)
        if (!inPanel && !inFrame) {
            // Already handled via shadow above
        }

    } else {
        // Ray going backward — just background
        col = background(rd);
    }

    // Glass-like reflection on frame: specular highlight from ceiling light
    if (rd.z < -0.0001) {
        float t = -PANEL_Z / rd.z;
        vec2 hit = vec2(rd.x, rd.y) * t;
        bool onFrame = abs(hit.x) < PANEL_W * 0.5 + FRAME
                    && abs(hit.y) < PANEL_H * 0.5 + FRAME
                    && !(abs(hit.x) < PANEL_W * 0.5 && abs(hit.y) < PANEL_H * 0.5);
        if (onFrame) {
            // Reflect ceiling light off frame surface
            vec3 norm = vec3(0.0, 0.0, 1.0);
            vec3 lightDir = normalize(vec3(0.3, 1.0, 0.8));
            float spec = pow(max(dot(reflect(-rd, norm), lightDir), 0.0), 32.0);
            col += vec3(0.95, 0.92, 0.85) * spec * 0.35;
        }
    }

    // Lens vignette
    float vig = 1.0 - 0.30 * pow(length((uv - 0.5) * vec2(asp, 1.0)) * 0.80, 2.0);
    col *= vig;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
