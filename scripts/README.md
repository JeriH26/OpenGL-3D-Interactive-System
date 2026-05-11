# Scripts Learning Guide: From `ray_sphere_learning` to `20_advanced_concepts`

This document summarizes the core formulas and principles for each lesson in order.

For the C++ study plan behind these scripts, see [CPP_LEARNING_METHOD.md](CPP_LEARNING_METHOD.md).

## Contents
- ray_sphere_learning
- 01_bounding_box_2d
- 02_ray_plane
- 03_ray_triangle
- 04_ray_aabb
- 05_ray_obb
- 06_mvp_matrices
- 07_normal_matrix
- 08_homogeneous_coords
- 09_phong_blinnphong
- 10_pbr_basics
- 11_shadow_map
- 12_cross_product
- 13_barycentric
- 14_rotation_quaternion
- 15_interpolation
- 16_depth_buffer
- 17_alpha_blending
- 18_mipmap
- 19_bvh_simple
- 20_advanced_concepts

---

## 01_bounding_box_2d: 2D Bounding Box Interview Basics

### Core formulas
- Point containment:
  $$p_x\in[\min_x,\max_x]\;\land\;p_y\in[\min_y,\max_y]$$
- AABB overlap as "not separated":
  $$\neg(a_{\max x}<b_{\min x}\lor a_{\min x}>b_{\max x}\lor a_{\max y}<b_{\min y}\lor a_{\min y}>b_{\max y})$$
- Union:
  $$\min=(\min(a_{\min},b_{\min})),\quad \max=(\max(a_{\max},b_{\max}))$$
- Intersection:
  $$\min=(\max(a_{\min},b_{\min})),\quad \max=(\min(a_{\max},b_{\max}))$$

### Principles
- `top-left + size` is convenient for UI and construction.
- `min + max` is usually better for geometry algorithms and interviews.
- Normalize negative width/height at construction time.
- Empty point sets should return no bounding box, often `std::optional<Box2D>`.
- Ray-vs-box in 2D uses the same slab method as 3D AABB, but only X/Y axes.

---

## ray_sphere_learning: Ray-Sphere Intersection

### Core formulas
- Ray equation:
  $$P(t)=O+tD,\; t\ge0$$
- Sphere equation:
  $$\|P-C\|^2=R^2$$
- Quadratic terms after substitution:
  $$a=D\cdot D$$
  $$\text{halfB}=(O-C)\cdot D$$
  $$c=\|O-C\|^2-R^2$$
  $$\Delta=\text{halfB}^2-a\,c$$
  $$t=\frac{-\text{halfB}\pm\sqrt{\Delta}}{a}$$

### Principles
- Discriminant meaning:
  - $\Delta<0$: no intersection
  - $\Delta=0$: tangent hit
  - $\Delta>0$: two intersections
- Use the smallest non-negative root as the first visible hit.
- `halfB` reduces operations and improves numerical stability.

---

## 02_ray_plane: Ray-Plane Intersection

### Core formulas
- Plane equation:
  $$N\cdot P=d$$
- Solve ray-plane intersection:
  $$t=\frac{d-N\cdot O}{N\cdot D}$$
- Plane from 3 points:
  $$N=\text{normalize}((B-A)\times(C-A)),\quad d=N\cdot A$$
- Reflection direction:
  $$R=D-2(D\cdot N)N$$

### Principles
- If $N\cdot D\approx0$, the ray is parallel to the plane.
- One-sided tests can be used for backface culling.
- For finite surfaces, run bounds checks after solving for $t$.

---

## 03_ray_triangle: Ray-Triangle Intersection (Moller-Trumbore)

### Core formulas
- Barycentric form:
  $$P=(1-u-v)V_0+uV_1+vV_2$$
- Inside-triangle condition:
  $$u\ge0,\;v\ge0,\;u+v\le1$$
- Standard Moller-Trumbore steps:
  $$E_1=V_1-V_0,\;E_2=V_2-V_0,\;S=O-V_0$$
  $$h=D\times E_2,\;a=E_1\cdot h$$
  $$f=1/a,\;u=f(S\cdot h)$$
  $$q=S\times E_1,\;v=f(D\cdot q)$$
  $$t=f(E_2\cdot q)$$

### Principles
- Converts inside-triangle testing into barycentric constraints.
- Efficient and widely used in real-time rendering.
- The sign of $a$ can be used for optional backface culling.

---

## 04_ray_aabb: Ray-AABB Intersection (Slab method)

### Core formulas
- Per-axis interval:
  $$t_1=\frac{\text{min}_i-O_i}{D_i},\quad t_2=\frac{\text{max}_i-O_i}{D_i}$$
  Swap if $t_1>t_2$.
- Global enter/exit times:
  $$t_{\text{enter}}=\max(t_{x\,near},t_{y\,near},t_{z\,near})$$
  $$t_{\text{exit}}=\min(t_{x\,far},t_{y\,far},t_{z\,far})$$
- Hit condition:
  $$t_{\text{enter}}\le t_{\text{exit}}\;\land\;t_{\text{exit}}\ge0$$

### Principles
- An AABB is the intersection of 3 axis-aligned slabs.
- Parallel-axis case requires origin inside that slab range.
- Commonly used as a fast broad-phase test in BVH traversal.

---

## 05_ray_obb: Ray-OBB Intersection

### Core formulas
- OBB is defined by center $C$, orthonormal axes $A_0,A_1,A_2$, half-extents $h_0,h_1,h_2$.
- Projection onto each OBB axis:
  $$e=(O-C)\cdot A_i,\quad f=D\cdot A_i$$
  $$t_1=\frac{-h_i-e}{f},\quad t_2=\frac{h_i-e}{f}$$
- Combine intervals the same way as slab-based AABB testing.

### Principles
- Equivalent to transforming the ray into OBB local space.
- More accurate for rotated objects than AABB, but slightly more expensive.

---

## 06_mvp_matrices: MVP Transform Pipeline

### Core formulas
- Vertex transform:
  $$p_{clip}=P\,V\,M\,p_{local}$$
- Perspective divide:
  $$p_{ndc}=p_{clip}.xyz/p_{clip}.w$$
- Screen mapping (conceptually):
  $$p_{screen}=(p_{ndc}+1)\times0.5\times\text{viewport}$$

### Principles
- `Model`: local to world.
- `View`: world to camera.
- `Projection`: camera to clip space.
- Matrix application order is right-to-left.

---

## 07_normal_matrix: Normal Matrix

### Core formula
- Correct normal transform:
  $$N' = \text{normalize}((M^{-1})^T N)$$

### Principles
- Directly using $M\,N$ fails under non-uniform scaling.
- Inverse-transpose preserves orthogonality for lighting.
- Use the 3x3 linear part only (translation does not affect directions).

---

## 08_homogeneous_coords: Homogeneous Coordinates

### Core formulas
- Point: $(x,y,z,1)$, direction: $(x,y,z,0)$.
- Perspective divide:
  $$ndc=(x/w,\;y/w,\;z/w)$$

### Principles
- 4D homogeneous form unifies translation, rotation, scale, and projection.
- Vectors with $w=0$ ignore translation terms.
- GPU performs perspective divide after clip-space output.

---

## 09_phong_blinnphong: Classic Lighting Models

### Core formulas
- Phong:
  $$I=k_aI_a+k_d\max(0,N\cdot L)I_d+k_s\max(0,R\cdot V)^nI_s$$
- Reflection vector:
  $$R=2(N\cdot L)N-L$$
- Blinn-Phong:
  $$H=\text{normalize}(L+V)$$
  $$I_{spec}=k_s\max(0,N\cdot H)^nI_s$$

### Principles
- Combines ambient, diffuse, and specular terms.
- Blinn-Phong is generally more stable and efficient.
- Larger shininess exponent $n$ gives sharper highlights.

---

## 10_pbr_basics: PBR Basics (Cook-Torrance)

### Core formulas
- Microfacet specular BRDF:
  $$f_r=\frac{D\,F\,G}{4(N\cdot V)(N\cdot L)}$$
- Fresnel-Schlick:
  $$F=F_0+(1-F_0)(1-V\cdot H)^5$$
- Typical direct lighting term:
  $$L_o=(k_d\,\frac{\text{albedo}}{\pi}+k_s\,f_r)\,L_i\,(N\cdot L)$$

### Principles
- `roughness` controls lobe spread.
- `metallic` controls diffuse/specular energy split.
- Typical dielectric $F_0$ is around 0.04.

---

## 11_shadow_map: Shadow Mapping

### Core formulas
- Light-space transform:
  $$p_l=LVP\,p_w$$
- Depth comparison in light UV space:
  $$z_{current}>z_{shadow}+bias \Rightarrow \text{in shadow}$$

### Principles
- Two passes:
  - Render depth from light view.
  - Render camera view and compare light-space depths.
- `bias` reduces shadow acne.
- PCF averages neighborhood comparisons for softer edges.

---

## 12_cross_product: Cross Product

### Core formulas
- Cross product:
  $$A\times B=(a_yb_z-a_zb_y,\;a_zb_x-a_xb_z,\;a_xb_y-a_yb_x)$$
- Magnitude:
  $$|A\times B|=|A||B|\sin\theta$$

### Principles
- Result is perpendicular to both inputs.
- Direction is given by the right-hand rule.
- Used for normals, area, and basis construction.

---

## 13_barycentric: Barycentric Coordinates

### Core formulas
- Point representation:
  $$P=\alpha V_0+\beta V_1+\gamma V_2,\quad \alpha+\beta+\gamma=1$$
- Inside-triangle condition:
  $$\alpha,\beta,\gamma\in[0,1]$$
- Attribute interpolation:
  $$X=\alpha X_0+\beta X_1+\gamma X_2$$

### Principles
- Naturally supports interpolation of color, UV, and normals over triangles.
- Fundamental in rasterization and ray-triangle intersection.

---

## 14_rotation_quaternion: Rotation and Quaternions

### Core formulas
- Axis-angle to quaternion:
  $$q=(\cos(\theta/2),\;\sin(\theta/2)\,\hat{u})$$
- Rotate vector with quaternion:
  $$v'=q\,v\,q^*$$

### Principles
- Euler angles are intuitive but can suffer gimbal lock.
- Matrices are efficient but less convenient for interpolation.
- Quaternions are ideal for composition and smooth rotation interpolation.

---

## 15_interpolation: Interpolation (lerp/nlerp/slerp)

### Core formulas
- Linear interpolation:
  $$\text{lerp}(a,b,t)=(1-t)a+tb$$
- Spherical linear interpolation:
  $$\text{slerp}(q_0,q_1,t)=\frac{\sin((1-t)\theta)}{\sin\theta}q_0+\frac{\sin(t\theta)}{\sin\theta}q_1$$
  $$\theta=\arccos(q_0\cdot q_1)$$

### Principles
- `lerp` is simple and fast.
- `slerp` preserves unit length and constant angular speed for rotations.
- `nlerp` is a fast approximation.

---

## 16_depth_buffer: Depth Buffer and Precision

### Core ideas
- Depth mapping is non-linear (high precision near the camera, low precision far away).
- Larger `far/near` ratio increases distant depth precision loss.

### Principles
- Z-fighting occurs when surfaces quantize to similar depth values.
- Increasing the near plane (for example, 0.1 -> 1.0) is often the most effective fix.
- Other options: 32-bit depth, reverse-Z, polygon offset.

---

## 17_alpha_blending: Alpha Blending

### Core formulas
- Standard alpha over:
  $$C_{out}=C_{src}\alpha_{src}+C_{dst}(1-\alpha_{src})$$
- Premultiplied alpha:
  $$C_{out}=C_{src,premul}+C_{dst}(1-\alpha_{src})$$

### Principles
- Typical rendering order: opaque first, transparent later (usually back-to-front).
- Premultiplied alpha reduces edge halos.
- Additive blending fits emissive effects like fire and bloom.

---

## 18_mipmap: Mipmap and Texture Filtering

### Core formulas
- Level $k$ resolution is approximately base resolution times $1/2^k$.
- Full mip chain total storage is roughly $4/3$ of base level.
- LOD approximation:
  $$\text{LOD}\approx\log_2(\rho)$$
  where $\rho$ depends on screen-space UV derivatives.

### Principles
- Mipmaps reduce aliasing and shimmering at distance.
- Trilinear filtering blends between mip levels for smoother transitions.
- Anisotropic filtering improves oblique-angle texture clarity.

---

## 19_bvh_simple: Simple BVH

### Core ideas
- Each node stores an AABB bound.
- Recursively split primitives (for example, longest-axis median split).
- During traversal, test AABB first and descend only on hits.

### Complexity intuition
- Brute force per ray is approximately $O(N)$.
- BVH traversal is typically near $O(\log N)$ on average.

### Principles
- Broad-phase pruning removes large amounts of irrelevant geometry early.
- BVH is a core acceleration structure for ray tracing.

---

## 20_advanced_concepts: Advanced Graphics Concepts

### 1) Forward vs Deferred
- Forward: per-object, per-light shading; simple pipeline; transparency friendly.
- Deferred: fill G-buffer first, then do lighting; efficient with many lights.

### 2) TAA (Temporal Anti-Aliasing)
- Projection jitter + history reprojection + blending.
- Key pieces are motion vectors and history clamping to avoid ghosting.

### 3) SSR (Screen-Space Reflections)
- Reconstruct position from depth and march along reflection direction in screen space.
- Off-screen data is unavailable, so fallback strategies are required.

### 4) SSAO (Screen-Space Ambient Occlusion)
- Sample depth in a normal-oriented hemisphere and estimate occlusion ratio.
- Usually paired with denoise/blur passes for stability.

---

## Study suggestions
- Start with ray/geometry intersections, then matrix spaces and coordinate transforms.
- Learn lighting in progression: Phong/Blinn-Phong -> PBR.
- For rendering quality/performance, prioritize depth precision, transparency ordering, mipmaps, and BVH.
- Introduce deferred/TAA/SSR/SSAO incrementally with visual debugging.
