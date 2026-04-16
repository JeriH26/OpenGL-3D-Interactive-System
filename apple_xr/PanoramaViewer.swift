// PanoramaViewer.swift  —  visionOS
// 等价于 xr_panorama.frag：把一张等距柱状全景图投影到球面内壁，
// 用户转头时看到 360° 环绕场景。
//
// 对应的 OpenGL 版本：
//   ./build/xr_viewer Shadertoy_Fragment/xr_panorama.frag --image panorama.jpg

import SwiftUI
import RealityKit

// ---------------------------------------------------------------------------
// MARK: - App 入口
// ---------------------------------------------------------------------------
@main
struct PanoramaViewerApp: App {
    var body: some Scene {
        ImmersiveSpace(id: "panorama") {
            PanoramaView()
        }
        .immersionStyle(selection: .constant(.full), in: .full)
        // .full = 完全沉浸，背景被全景图替换（等价于 xr_panorama 的效果）
    }
}

// ---------------------------------------------------------------------------
// MARK: - 全景视图
// ---------------------------------------------------------------------------
struct PanoramaView: View {
    let imageName = "my_panorama"   // 等距柱状全景图，放在 Assets.xcassets

    var body: some View {
        RealityView { content in
            // ① 生成一个大球体（半径 50m，用户站在球心）
            //    等价于 xr_panorama.frag 里把射线投影到单位球面采样
            let sphere = MeshResource.generateSphere(radius: 50)

            // ② 加载全景纹理
            guard let texture = try? await TextureResource(named: imageName) else {
                return
            }

            // ③ 关键：开启 .frontFacing = false（从内部看球面）
            //    默认球体只渲染外表面，这里需要渲染内表面
            var material = UnlitMaterial()   // Unlit = 不受场景光照影响，纯纹理颜色
            material.color = .init(texture: .init(texture))

            let sphereEntity = ModelEntity(mesh: sphere, materials: [material])

            // ④ 翻转球体法线（让内表面可见）
            //    等价于 xr_panorama.frag 里射线从内向外采样
            sphereEntity.scale = SIMD3(-1, 1, 1)   // X 轴翻转 = 法线翻转

            // ⑤ 球心放在用户头部位置（通过 AnchorEntity 锁定到摄像机）
            let cameraAnchor = AnchorEntity(.head)
            cameraAnchor.addChild(sphereEntity)
            content.add(cameraAnchor)
        }
    }
}

// ---------------------------------------------------------------------------
// MARK: - 对比说明
// ---------------------------------------------------------------------------
/*
  xr_panorama.frag（OpenGL）            PanoramaViewer.swift（visionOS）
  ─────────────────────────────────     ────────────────────────────────────────
  逆球面投影公式（atan/asin）            MeshResource.generateSphere 自动处理 UV
  equiUV(ray) 计算纹理坐标              球体内置等距柱状 UV mapping
  鼠标 yaw/pitch 旋转视角               AnchorEntity(.head) 跟随头部自动旋转
  iDistance 控制 FOV                   用户通过手势捏合缩放（系统手势）
  chromatic aberration 手动计算         Vision Pro 镜头在硬件层校正
  barrel distortion 模拟               硬件镜头 + 系统级畸变 LUT 校正
  程序化天空 fallback                   直接用纹理（RealityKit 不需要 fallback）
*/
