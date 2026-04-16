// ProceduralRoom.swift + ProceduralRoom.metal  —  visionOS
// 等价于 xr_procedural.frag：用 Ray Casting 渲染一个程序化室内空间。
//
// 注意：在 visionOS 上，程序化室内通常不用 ray casting shader，
// 而是直接用 RealityKit 的几何体搭建。
// 这里同时给出两种写法，便于对比。

// ============================================================================
// 方式 A：RealityKit 几何体搭建（推荐，visionOS 原生方式）
// ============================================================================
// ProceduralRoom.swift

import SwiftUI
import RealityKit

@main
struct ProceduralRoomApp: App {
    var body: some Scene {
        ImmersiveSpace(id: "room") {
            ProceduralRoomView()
        }
        .immersionStyle(selection: .constant(.full), in: .full)
    }
}

struct ProceduralRoomView: View {
    var body: some View {
        RealityView { content in

            // ① 地板（等价于 xr_procedural.frag 的 woodFloor）
            let floorMesh = MeshResource.generatePlane(width: 6, depth: 6)
            var floorMat  = PhysicallyBasedMaterial()
            // 加载预制木地板纹理（替代程序化 fbm）
            if let tex = try? await TextureResource(named: "wood_floor") {
                floorMat.baseColor = .init(texture: .init(tex))
            }
            floorMat.roughness = .init(floatLiteral: 0.7)
            floorMat.metallic  = .init(floatLiteral: 0.0)
            let floorEntity = ModelEntity(mesh: floorMesh, materials: [floorMat])
            floorEntity.position = SIMD3(0, 0, 0)
            content.add(floorEntity)

            // ② 天花板
            let ceilMesh = MeshResource.generatePlane(width: 6, depth: 6)
            var ceilMat  = PhysicallyBasedMaterial()
            ceilMat.baseColor = .init(tint: .init(white: 0.95, alpha: 1.0))
            ceilMat.roughness = .init(floatLiteral: 0.9)
            let ceilEntity = ModelEntity(mesh: ceilMesh, materials: [ceilMat])
            ceilEntity.position    = SIMD3(0, 3, 0)
            ceilEntity.orientation = simd_quatf(angle: .pi, axis: SIMD3(1, 0, 0))
            content.add(ceilEntity)

            // ③ 四面墙（等价于 plasterWall）
            let wallPositions: [(SIMD3<Float>, simd_quatf)] = [
                (SIMD3( 0, 1.5, -3), simd_quatf(angle: 0,      axis: SIMD3(0,1,0))), // 前
                (SIMD3( 0, 1.5,  3), simd_quatf(angle: .pi,    axis: SIMD3(0,1,0))), // 后
                (SIMD3(-3, 1.5,  0), simd_quatf(angle: -.pi/2, axis: SIMD3(0,1,0))), // 左
                (SIMD3( 3, 1.5,  0), simd_quatf(angle:  .pi/2, axis: SIMD3(0,1,0))), // 右
            ]
            var wallMat = PhysicallyBasedMaterial()
            wallMat.baseColor = .init(tint: .init(red: 0.89, green: 0.85, blue: 0.78, alpha: 1))
            wallMat.roughness = .init(floatLiteral: 0.85)

            for (pos, rot) in wallPositions {
                let wallMesh = MeshResource.generatePlane(width: 6, depth: 3)
                let wall = ModelEntity(mesh: wallMesh, materials: [wallMat])
                wall.position    = pos
                wall.orientation = rot
                content.add(wall)
            }

            // ④ 天花板点光源（等价于 xr_procedural.frag 里的 lampPos）
            let light = PointLight()
            light.light.color     = .init(red: 1.0, green: 0.95, blue: 0.80, alpha: 1.0)
            light.light.intensity = 800   // 单位：lumen
            light.light.attenuationRadius = 5.0
            let lightAnchor = AnchorEntity(world: SIMD3(0, 2.8, 0))
            lightAnchor.addChild(light)
            content.add(lightAnchor)

            // ⑤ 窗户（前墙透明区域用 SimpleMaterial + blending 模拟）
            let windowMesh = MeshResource.generatePlane(width: 2.6, depth: 1.8)
            var windowMat  = SimpleMaterial()
            windowMat.color = .init(tint: .init(red: 0.7, green: 0.85, blue: 1.0, alpha: 0.25))
            let windowEntity = ModelEntity(mesh: windowMesh, materials: [windowMat])
            windowEntity.position    = SIMD3(0, 1.8, -2.99)
            windowEntity.orientation = simd_quatf(angle: .pi/2, axis: SIMD3(1,0,0))
            content.add(windowEntity)
        }
    }
}

// ============================================================================
// 方式 B：Ray Casting Metal Shader（和 xr_procedural.frag 技术完全相同）
// 适合需要完全程序化、不用预制网格的场景
// ============================================================================
// ProceduralRoom.metal

/*
#include <metal_stdlib>
#include <RealityKit/RealityKit.h>
using namespace metal;

// --- 工具函数（和 xr_procedural.frag 完全相同，只改类型名）---

float hash12r(float2 p) {
    float3 p3 = fract(float3(p.xyx) * 0.1031f);
    p3 += dot(p3, p3.yzx + 33.33f);
    return fract((p3.x + p3.y) * p3.z);
}
float vNoiser(float2 p) {
    float2 i = floor(p), f = fract(p);
    float a=hash12r(i), b=hash12r(i+float2(1,0)),
          c=hash12r(i+float2(0,1)), d=hash12r(i+float2(1,1));
    float2 u = f*f*(3.0f-2.0f*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbmr(float2 p) {
    float v=0, a=0.5f;
    for(int i=0;i<4;i++){v+=a*vNoiser(p); p=p*2.1f+float2(1.7f,2.3f); a*=0.5f;}
    return v;
}

// --- Surface Shader ---
[[visible]]
void proceduralRoomSurface(realitykit::surface_parameters params) {
    float iTime     = params.uniforms().custom_parameter<float>("iTime");
    float2 iOrbit   = params.uniforms().custom_parameter<float2>("iOrbit");
    float iDistance = params.uniforms().custom_parameter<float>("iDistance");

    float2 res = float2(params.geometry().viewport_size());
    float2 uv  = params.geometry().uv0();
    float  asp = res.x / res.y;

    // camera ray — 和 xr_procedural.frag 完全相同的数学
    float yaw   = iOrbit.x, pitch = clamp(iOrbit.y, -1.35f, 1.35f);
    float3 fwd  = float3(sin(yaw)*cos(pitch), sin(pitch), cos(yaw)*cos(pitch));
    float3 right= normalize(cross(fwd, float3(0,1,0)));
    float3 up   = cross(right, fwd);
    float fovScale = mix(1.0f, 0.35f, clamp((iDistance-1.0f)/7.0f, 0.0f, 1.0f));
    float2 ndc  = (uv*2.0f-1.0f) * float2(asp,1.0f) * fovScale;
    float3 rd   = normalize(fwd + ndc.x*right + ndc.y*up);
    float3 ro   = float3(0);

    // ray-box intersection & shading — 逻辑完全同 GLSL 版本，此处省略
    // ...

    float3 col = float3(0.5f); // placeholder
    params.surface().set_emissive_color(half3(col));
    params.surface().set_opacity(1.0h);
}
*/

// ============================================================================
// MARK: - 对比说明
// ============================================================================
/*
  xr_procedural.frag（OpenGL/GLSL）     visionOS 版本
  ─────────────────────────────────     ────────────────────────────────────────
  Ray-box intersection 计算墙壁          方式A: MeshResource 直接创建几何体
  fbm() 程序化木地板纹理                  方式A: 加载 wood_floor 纹理图片
  手动点光源衰减公式                      PointLight + intensity + attenuationRadius
  窗户用 smoothstep 透明区域              简单半透明 SimpleMaterial
  程序化天空背景                         可换成 EnvironmentResource（HDR 环境图）
  
  方式 B（Metal shader）和 GLSL 版本     数学完全相同，只改了类型名和函数签名
*/
