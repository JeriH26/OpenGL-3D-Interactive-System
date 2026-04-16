// CloudShader.metal  —  Metal Shading Language (MSL)
// 等价于 cloud_fog_particles.frag（GLSL）
// 用于 visionOS / iOS / macOS 上的 RealityKit 自定义材质。
//
// 使用方式（RealityKit）：
//   let mat = CustomMaterial(surfaceShader: .init(named: "cloudSurface", in: .main),
//                            geometryModifier: nil,
//                            lightingModel: .unlit)
//
// MSL 和 GLSL 的关键语法差异：
//   GLSL vec2/vec3/vec4   →  MSL float2/float3/float4
//   GLSL mix(a,b,t)       →  MSL mix(a,b,t)           (相同)
//   GLSL smoothstep(e0,e1,x) → MSL smoothstep(e0,e1,x) (相同)
//   GLSL mat2             →  MSL float2x2
//   GLSL uniform          →  MSL 通过 constant buffer 或 [[stage_in]] 传入
//   GLSL iTime/iResolution→  通过 CustomMaterial.Parameter 传入

#include <metal_stdlib>
#include <RealityKit/RealityKit.h>
using namespace metal;

// ---------------------------------------------------------------------------
// MARK: - 工具函数（和 GLSL 版本数学完全相同，只改了类型名）
// ---------------------------------------------------------------------------

float hash12(float2 p) {
    float3 p3 = fract(float3(p.xyx) * 0.1031f);
    p3 += dot(p3, p3.yzx + 33.33f);
    return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float a = hash12(i);
    float b = hash12(i + float2(1.0f, 0.0f));
    float c = hash12(i + float2(0.0f, 1.0f));
    float d = hash12(i + float2(1.0f, 1.0f));
    float2 u = f * f * (3.0f - 2.0f * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
    float v = 0.0f;
    float a = 0.5f;
    // GLSL: mat2 m = mat2(1.7, 1.1, -1.1, 1.7);
    // MSL: float2x2 的构造是按列优先
    float2x2 m = float2x2(float2(1.7f, -1.1f), float2(1.1f, 1.7f));
    for (int i = 0; i < 5; ++i) {
        v += a * valueNoise(p);
        p  = m * p;
        a *= 0.5f;
    }
    return v;
}

// ---------------------------------------------------------------------------
// MARK: - Surface Shader（等价于 fragment shader 的 mainImage）
//
// RealityKit 的 CustomMaterial Surface Shader 签名是固定的：
//   void shaderName(realitykit::surface_parameters params)
//
// 对比 GLSL：
//   mainImage(out vec4 fragColor, in vec2 fragCoord)  →  surface_parameters
//   fragColor = vec4(col, 1.0)                        →  params.surface().set_emissive_color(col)
//   iResolution                                       →  params.geometry().viewport_size()
//   iTime                                             →  params.uniforms().custom_parameter<float>("iTime")
// ---------------------------------------------------------------------------
[[visible]]
void cloudSurface(realitykit::surface_parameters params) {

    // 从 CustomMaterial 参数读取 iTime（C++ 侧每帧更新）
    float t = params.uniforms().custom_parameter<float>("iTime");

    // 屏幕坐标（等价于 fragCoord）
    float2 fragCoord = params.geometry().viewport_size()
                     * params.geometry().uv0();   // surface UV → pixel position

    float2 res = float2(params.geometry().viewport_size());
    float2 uv  = fragCoord / res;
    float2 p   = (fragCoord - 0.5f * res) / res.y;

    float r = length(p);

    // 背景
    float3 col = float3(0.014f, 0.018f, 0.028f);

    // 天空渐变
    float3 skyTop    = float3(0.20f, 0.42f, 0.72f);
    float3 skyMid    = float3(0.42f, 0.64f, 0.86f);
    float3 skyBottom = float3(0.68f, 0.82f, 0.94f);
    float h          = smoothstep(0.0f, 1.0f, uv.y);
    float3 skyColor  = mix(mix(skyBottom, skyMid, smoothstep(0.0f, 0.60f, h)),
                           skyTop, smoothstep(0.45f, 1.0f, h));

    // 云团位移
    float2 center = float2(0.09f * sin(t * 0.22f), 0.06f * sin(t * 0.17f + 1.4f));
    float2 q      = p - center;
    float  rq     = length(q);
    float  angQ   = atan2(q.y, q.x);
    float2 dirQ   = float2(cos(angQ), sin(angQ));

    // 边界噪声
    float boundaryNoiseA = fbm(q * 3.4f + float2(t * 0.04f, -t * 0.03f));
    float boundaryNoiseB = fbm(float2(dirQ.x*1.4f + dirQ.y*0.9f, rq*4.2f - t*0.02f));
    float edgeWarp = (boundaryNoiseA - 0.5f) * 0.13f + (boundaryNoiseB - 0.5f) * 0.07f;

    // 缩放（从 CustomMaterial 参数读取 iDistance）
    float iDistance = params.uniforms().custom_parameter<float>("iDistance");
    float zoom01    = clamp((iDistance - 1.2f) / (8.0f - 1.2f), 0.0f, 1.0f);
    float sizeScale = mix(1.55f, 0.55f, zoom01);
    float blobRadius = 0.46f * sizeScale;
    float blobMask   = smoothstep(blobRadius + 0.07f, blobRadius - 0.07f, rq + edgeWarp);

    // 云纹理
    float2 cloudUv = q * 1.8f + float2(t * 0.02f, -t * 0.01f);
    float c1 = fbm(cloudUv * 2.6f);
    float c2 = fbm(cloudUv * 5.0f + 7.1f);
    float cloudTex  = mix(c1, c2, 0.45f);
    float cloudMask = smoothstep(0.46f, 0.70f, cloudTex);

    float3 cloudCol = float3(0.82f, 0.88f, 0.94f);
    float3 blobCol  = mix(skyColor, cloudCol, cloudMask * 0.92f);

    // 边缘雾气
    float warpedR = rq + edgeWarp;
    float fogEdge = smoothstep(blobRadius + 0.28f, blobRadius - 0.06f, warpedR);
    blobCol = mix(blobCol, float3(0.72f, 0.79f, 0.88f), fogEdge * 0.06f);

    // 太阳光
    float2 sunDir   = normalize(float2(0.55f, 0.70f));
    float3 sunColor = float3(1.00f, 0.93f, 0.68f);
    float sunFacing = dot(q / max(blobRadius, 0.001f), sunDir);
    float sunGlow   = smoothstep(-0.1f, 0.9f, sunFacing) * cloudMask;
    blobCol += sunColor * sunGlow * 0.14f;

    // 合成
    float edgeAlpha = smoothstep(0.06f, 0.98f, blobMask);
    col = mix(col, blobCol, edgeAlpha);

    // 银边
    float edgePct  = smoothstep(blobRadius - 0.06f, blobRadius + 0.06f, warpedR);
    float silverRim = edgePct * (1.0f - edgePct) * 4.0f;
    silverRim *= pow(max(dot(normalize(q + float2(1e-4f)), sunDir), 0.0f), 1.5f);
    col += sunColor * silverRim * 0.18f;

    // 暗角
    float vignette = smoothstep(1.25f, 0.20f, r);
    col *= 0.90f + 0.10f * vignette;

    // 输出：RealityKit 用 emissive（自发光）= Unlit 效果，等价于 GLSL 直接输出颜色
    params.surface().set_emissive_color(half3(col));
    params.surface().set_opacity(1.0h);
}

// ---------------------------------------------------------------------------
// MARK: - C++ 侧的使用方式（放在 Swift/ObjC 桥接代码里）
// ---------------------------------------------------------------------------
/*
// 每帧更新参数（等价于 glUniform1f(timeLoc, glfwGetTime())）：
var mat = entity.model!.materials[0] as! CustomMaterial
mat.custom.value = [
    "iTime":     .float(Float(Date().timeIntervalSinceReferenceDate)),
    "iDistance": .float(currentDistance)
]
entity.model!.materials = [mat]
*/
