// PhotoViewer.swift  —  visionOS
// 等价于 xr_photo.frag：把一张照片作为悬浮面板显示在虚拟空间中。
//
// 运行环境：Xcode 15+，visionOS 1.0+，需要 Apple Vision Pro 模拟器或真机。
// 对应的 OpenGL 版本：xr_viewer Shadertoy_Fragment/xr_photo.frag --image photo.jpg

import SwiftUI
import RealityKit

// ---------------------------------------------------------------------------
// MARK: - App 入口
// ---------------------------------------------------------------------------
@main
struct PhotoViewerApp: App {
    var body: some Scene {
        // ImmersiveSpace：占据整个 visionOS 视野（相当于全屏 XR 模式）
        ImmersiveSpace(id: "photo") {
            PhotoImmersiveView()
        }
        .immersionStyle(selection: .constant(.mixed), in: .mixed)
        // .mixed = 照片悬浮在真实房间里（pass-through 背景）
        // 如果改成 .full，背景变纯黑，像你的 xr_photo.frag 效果
    }
}

// ---------------------------------------------------------------------------
// MARK: - 沉浸式视图
// ---------------------------------------------------------------------------
struct PhotoImmersiveView: View {
    // 要显示的图片名称（放在 Assets.xcassets 里）
    let imageName = "my_photo"

    var body: some View {
        RealityView { content in
            // ① 创建一个矩形平面网格（宽 1.8m，高 1.0m — 和 xr_photo.frag 的 PANEL_W/H 相同）
            let mesh = MeshResource.generatePlane(
                width: 1.8,
                height: 1.0,
                cornerRadius: 0.02   // 圆角，Vision Pro 标准设计语言
            )

            // ② 加载照片作为纹理，创建 PBR 材质
            var material = PhysicallyBasedMaterial()
            if let texture = try? await TextureResource(named: imageName) {
                material.baseColor = .init(texture: .init(texture))
            }
            // 无金属感，轻微粗糙度（接近相纸质感）
            material.metallic  = .init(floatLiteral: 0.0)
            material.roughness = .init(floatLiteral: 0.4)

            // ③ 创建实体，赋予网格和材质
            let photoEntity = ModelEntity(mesh: mesh, materials: [material])

            // ④ 把照片放在摄像机前方 2 米处，略微抬高（眼睛中线高度）
            //    等价于 xr_photo.frag 里的 PANEL_Z = 2.0
            photoEntity.position = SIMD3(0, 1.5, -2.0)

            // ⑤ 白色相框：用稍大一点的平面 + 白色材质叠在后面
            let frameMesh = MeshResource.generatePlane(
                width: 1.87,
                height: 1.07,
                cornerRadius: 0.025
            )
            var frameMat = PhysicallyBasedMaterial()
            frameMat.baseColor = .init(tint: .white)
            frameMat.roughness = .init(floatLiteral: 0.2)
            frameMat.metallic  = .init(floatLiteral: 0.05)
            let frameEntity = ModelEntity(mesh: frameMesh, materials: [frameMat])
            frameEntity.position = SIMD3(0, 0, -0.002)  // 略微向后，避免 z-fighting

            // ⑥ 组合：frame 是 photo 的子节点
            photoEntity.addChild(frameEntity)

            // ⑦ 投影阴影（RealityKit 自动处理，只需打开 castsShadow）
            photoEntity.components.set(GroundingShadowComponent(castsShadow: true))

            content.add(photoEntity)
        }
    }
}

// ---------------------------------------------------------------------------
// MARK: - 对比说明
// ---------------------------------------------------------------------------
/*
  xr_photo.frag（OpenGL）              PhotoViewer.swift（visionOS RealityKit）
  ─────────────────────────────────    ─────────────────────────────────────────
  Ray-plane intersection               MeshResource.generatePlane（引擎自动做）
  texture(iChannel0, photoUV)          TextureResource + PhysicallyBasedMaterial
  自己算相框 geometry                   addChild(frameEntity)
  panelShadow() 高斯函数模拟             GroundingShadowComponent（真实阴影）
  background() 程序化背景               .mixed 模式直接用真实房间（pass-through）
  鼠标 yaw/pitch 控制视角               头显 IMU 自动追踪（R1 芯片，< 12ms 延迟）
  手动维护渲染循环                       SwiftUI body 驱动，RealityKit 自动渲染
*/
