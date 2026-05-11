// ================================================================
// 01_bounding_box_2d.cpp  -- 2D Bounding Box Interview Basics
// ================================================================
// Common 2D box representations:
//   1) top-left + size: useful for UI/screen rectangles
//   2) min + max: useful for geometry, overlap, union, ray tests
//
// This script uses top-left + size in the constructor, then normalizes
// internally to min/max because interview algorithms are simpler that way.
//
// Coordinate note:
// - Many UI systems use y-down, so "top-left" is natural.
// - Geometry/math often uses y-up. min/max still works in either system
//   as long as min contains the smaller coordinates and max the larger ones.
// ================================================================

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <iostream>
#include <optional>
#include <string>
#include <vector>

struct Vec2 {
    double x = 0.0;
    double y = 0.0;

    Vec2() = default;
    Vec2(double x_, double y_) : x(x_), y(y_) {}

    Vec2 operator+(const Vec2& r) const { return {x + r.x, y + r.y}; }
    Vec2 operator*(double s) const { return {x * s, y * s}; }
    double operator[](int i) const { return i == 0 ? x : y; }
};

struct Ray2D {
    Vec2 origin;
    Vec2 direction;
};

struct Box2D {
    Vec2 mn;
    Vec2 mx;

    Box2D() = default;

    // Interview-friendly constructor: top-left corner + size.
    Box2D(const Vec2& topLeft, const Vec2& size) {
        Vec2 bottomRight = topLeft + size;
        mn = {std::min(topLeft.x, bottomRight.x), std::min(topLeft.y, bottomRight.y)};
        mx = {std::max(topLeft.x, bottomRight.x), std::max(topLeft.y, bottomRight.y)};
    }

    Box2D(double x, double y, double width, double height)
        : Box2D(Vec2{x, y}, Vec2{width, height}) {}

    static Box2D fromMinMax(const Vec2& minCorner, const Vec2& maxCorner) {
        Box2D b;
        b.mn = {std::min(minCorner.x, maxCorner.x), std::min(minCorner.y, maxCorner.y)};
        b.mx = {std::max(minCorner.x, maxCorner.x), std::max(minCorner.y, maxCorner.y)};
        return b;
    }

    double left() const { return mn.x; }
    double right() const { return mx.x; }
    double bottom() const { return mn.y; }
    double top() const { return mx.y; }
    double width() const { return mx.x - mn.x; }
    double height() const { return mx.y - mn.y; }
};

struct HitInfo {
    bool hit = false;
    double tNear = -1.0;
    double tFar = -1.0;
    Vec2 point{};
};

// ---- 1. Point inside box ----
static bool contains(const Box2D& box, const Vec2& p) {
    return p.x >= box.mn.x && p.x <= box.mx.x &&
           p.y >= box.mn.y && p.y <= box.mx.y;
}

// ---- 2. AABB overlap test ----
static bool overlaps(const Box2D& a, const Box2D& b) {
    // The boxes do NOT overlap only when one is completely left/right/above/below.
    return !(a.mx.x < b.mn.x ||
             a.mn.x > b.mx.x ||
             a.mx.y < b.mn.y ||
             a.mn.y > b.mx.y);
}

// ---- 3. Union / merged bounding box ----
static Box2D unite(const Box2D& a, const Box2D& b) {
    return Box2D::fromMinMax(
        {std::min(a.mn.x, b.mn.x), std::min(a.mn.y, b.mn.y)},
        {std::max(a.mx.x, b.mx.x), std::max(a.mx.y, b.mx.y)}
    );
}

// ---- 4. Intersection region ----
static std::optional<Box2D> intersection(const Box2D& a, const Box2D& b) {
    Vec2 mn{std::max(a.mn.x, b.mn.x), std::max(a.mn.y, b.mn.y)};
    Vec2 mx{std::min(a.mx.x, b.mx.x), std::min(a.mx.y, b.mx.y)};

    if (mn.x > mx.x || mn.y > mx.y) return std::nullopt;
    return Box2D::fromMinMax(mn, mx);
}

// ---- 5. Build bounds from points ----
static std::optional<Box2D> boundsFromPoints(const std::vector<Vec2>& points) {
    if (points.empty()) return std::nullopt;

    Vec2 mn = points[0];
    Vec2 mx = points[0];
    for (const Vec2& p : points) {
        mn.x = std::min(mn.x, p.x);
        mn.y = std::min(mn.y, p.y);
        mx.x = std::max(mx.x, p.x);
        mx.y = std::max(mx.y, p.y);
    }
    return Box2D::fromMinMax(mn, mx);
}

// ---- 6. Ray vs 2D AABB using the slab method ----
static HitInfo intersectRayBox2D(const Ray2D& ray, const Box2D& box) {
    double tEnter = -1e30;
    double tExit = 1e30;

    for (int i = 0; i < 2; ++i) {
        const double origin = ray.origin[i];
        const double dir = ray.direction[i];
        const double bMin = box.mn[i];
        const double bMax = box.mx[i];

        if (std::abs(dir) < 1e-9) {
            if (origin < bMin || origin > bMax) return {};
            continue;
        }

        double t1 = (bMin - origin) / dir;
        double t2 = (bMax - origin) / dir;
        if (t1 > t2) std::swap(t1, t2);

        tEnter = std::max(tEnter, t1);
        tExit = std::min(tExit, t2);
        if (tEnter > tExit) return {};
    }

    if (tExit < 0.0) return {};

    HitInfo h;
    h.hit = true;
    h.tNear = tEnter >= 0.0 ? tEnter : 0.0;
    h.tFar = tExit;
    h.point = ray.origin + ray.direction * h.tNear;
    return h;
}

static void printBox(const Box2D& b) {
    std::cout << "min=(" << b.mn.x << "," << b.mn.y << ") "
              << "max=(" << b.mx.x << "," << b.mx.y << ") "
              << "size=(" << b.width() << "," << b.height() << ")";
}

static void printTheory() {
    std::cout << "================ 2D Bounding Box Interview Basics ================\n";
    std::cout << "Representations:\n";
    std::cout << "  UI style:       Box(topLeft, size)\n";
    std::cout << "  Geometry style: Box(minCorner, maxCorner)\n\n";
    std::cout << "Most interview formulas are easiest with min/max:\n";
    std::cout << "  contains: p.x in [min.x,max.x] AND p.y in [min.y,max.y]\n";
    std::cout << "  overlap:  NOT separated on X or Y\n";
    std::cout << "  union:    min of mins, max of maxes\n";
    std::cout << "  ray hit:  2D slab method, same idea as 3D AABB\n";
    std::cout << "===================================================================\n\n";
}

static void runTests() {
    std::cout << std::boolalpha << std::fixed << std::setprecision(3);

    Box2D a({10, 20}, {100, 50});       // top-left + size
    Box2D b({80, 40}, {60, 60});
    Box2D c({200, 40}, {20, 20});

    std::cout << "Constructor from top-left + size:\n";
    std::cout << "  a = "; printBox(a); std::cout << "\n\n";

    std::cout << "1) contains(point)\n";
    std::cout << "  contains(a, {30, 40})  -> " << contains(a, {30, 40}) << "  expected true\n";
    std::cout << "  contains(a, {5, 40})   -> " << contains(a, {5, 40}) << "  expected false\n\n";

    std::cout << "2) overlaps(a, b)\n";
    std::cout << "  overlaps(a, b) -> " << overlaps(a, b) << "  expected true\n";
    std::cout << "  overlaps(a, c) -> " << overlaps(a, c) << "  expected false\n\n";

    std::cout << "3) unite(a, b)\n";
    std::cout << "  "; printBox(unite(a, b)); std::cout << "\n\n";

    std::cout << "4) intersection(a, b)\n";
    if (auto r = intersection(a, b)) {
        std::cout << "  "; printBox(*r); std::cout << "\n\n";
    }
    std::cout << "  intersection(a, c) exists -> " << static_cast<bool>(intersection(a, c))
              << "  expected false\n\n";

    std::cout << "5) boundsFromPoints(points)\n";
    std::vector<Vec2> points = {{3, 7}, {-2, 4}, {10, 1}, {6, 12}};
    if (auto r = boundsFromPoints(points)) {
        std::cout << "  "; printBox(*r); std::cout << "\n\n";
    }

    std::cout << "6) intersectRayBox2D(ray, box)\n";
    Ray2D ray{{0, 45}, {1, 0}};
    HitInfo hit = intersectRayBox2D(ray, a);
    std::cout << "  Ray origin=(0,45), dir=(1,0), box=a\n";
    std::cout << "  hit=" << hit.hit << "  tNear=" << hit.tNear << "  tFar=" << hit.tFar
              << "  point=(" << hit.point.x << "," << hit.point.y << ")\n\n";
}

static void printChecklist() {
    std::cout << "Interview Checklist:\n";
    std::cout << "  [ ] Be clear whether edges are inclusive or exclusive\n";
    std::cout << "  [ ] Normalize negative width/height if using top-left + size\n";
    std::cout << "  [ ] Prefer min/max for geometry algorithms\n";
    std::cout << "  [ ] Empty point list should return optional/no box\n";
    std::cout << "  [ ] Ray test must handle direction.x == 0 or direction.y == 0\n";
    std::cout << "  [ ] AABB is fast but can be loose for rotated objects; OBB is tighter\n";
}

int main() {
    printTheory();
    runTests();
    printChecklist();
    return 0;
}

/*
Interview Follow-up Q&A:
Q: Why store min/max even if the constructor accepts top-left + size?
A key points:
- top-left + size is convenient for UI input.
- min/max is simpler for contains, overlap, union, intersection, and ray tests.
- Normalizing once in the constructor avoids bugs from negative width/height.

Q: What are the four separating cases for two 2D AABBs?
A key points:
- a is completely left of b:  a.max.x < b.min.x
- a is completely right of b: a.min.x > b.max.x
- a is completely below b:    a.max.y < b.min.y
- a is completely above b:    a.min.y > b.max.y
- If none are true, the boxes overlap.
*/
