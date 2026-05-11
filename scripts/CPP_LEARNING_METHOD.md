# C++ Learning Method And Goals

This guide is for learning C++ through the rendering/math scripts in this repository.

The goal is not to memorize the whole language first. The goal is to build enough C++ skill to read, write, debug, and explain small graphics programs clearly.

## Learning Goals

By the end of this path, you should be able to:

- Write small C++ programs without relying on templates or advanced features.
- Design simple data types such as `Vec2`, `Vec3`, `Ray`, `Box2D`, `AABB`, and `Triangle`.
- Understand constructors, member functions, references, pointers, and `const`.
- Use common standard library types such as `std::vector`, `std::string`, `std::array`, `std::optional`, and `std::unique_ptr`.
- Explain when to pass by value, pointer, or `const T&`.
- Compile, run, debug, and fix C++ code from compiler errors.
- Implement common graphics/math interview problems such as bounding boxes, ray intersections, matrices, normals, and interpolation.
- Read OpenGL-related C++ code without getting blocked by syntax.

## Recommended Learning Order

### Stage 1: Minimum C++ Syntax

Focus on the smallest set of syntax needed to write working programs:

- Variables
- Functions
- `if`, `for`, `while`
- `struct`
- Basic `class`
- Constructors
- `#include`
- `main()`
- Basic console output with `std::cout`

Example:

```cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> nums = {1, 2, 3};

    for (int x : nums) {
        std::cout << x << "\n";
    }

    return 0;
}
```

### Stage 2: Objects And Constructors

Practice small data types first:

```cpp
struct Vec2 {
    double x = 0.0;
    double y = 0.0;

    Vec2() = default;
    Vec2(double x_, double y_) : x(x_), y(y_) {}
};
```

Then build types from other types:

```cpp
struct Box2D {
    Vec2 mn;
    Vec2 mx;

    Box2D(const Vec2& topLeft, const Vec2& size);
};
```

Key goal: understand how objects are initialized and copied.

### Stage 3: References, Pointers, Const, And Lifetime

This is the most important C++ stage.

You should be able to explain the difference between:

```cpp
T value;
T* pointer;
T& reference;
const T& readonlyReference;
```

Answers:

- `T value`
  - This creates a real object.
  - The variable owns its own storage.
  - Passing it to a function by value usually copies it.

```cpp
Vec2 a{1.0, 2.0};       // a is an actual Vec2 object
Vec2 b = a;             // b is a copy of a
```

- `T* pointer`
  - This stores the address of an object.
  - It can point to an object, or it can be `nullptr`.
  - Use it when "no object" is a valid state, or when you need to reassign what it points to.
  - Always check for null before dereferencing if null is possible.

```cpp
Vec2 a{1.0, 2.0};
Vec2* p = &a;

if (p != nullptr) {
    p->x = 3.0;
}
```

- `T& reference`
  - This is another name for an existing object.
  - It cannot be null.
  - It must be initialized when created.
  - Use it when the function requires a valid object and may modify it.

```cpp
void moveRight(Vec2& p) {
    p.x += 1.0;
}
```

- `const T& readonlyReference`
  - This is a read-only reference to an existing object.
  - It avoids copying.
  - It guarantees the function will not modify the object through that reference.
  - This is the most common parameter style for reading larger objects.

```cpp
void printPoint(const Vec2& p) {
    std::cout << p.x << ", " << p.y << "\n";
}
```

Learn these concepts carefully:

- Stack vs heap
- Object lifetime
- Copying vs referencing
- `const` correctness
- Null pointer risk
- When to use `std::unique_ptr`

Question: What is the stack?

Answer:

The stack stores local variables whose lifetime is tied to scope. It is fast and automatic. When the function or block ends, those local objects are destroyed automatically.

```cpp
void example() {
    Vec2 p{1.0, 2.0};   // stack object
}                       // p is destroyed here
```

Question: What is the heap?

Answer:

The heap stores dynamically allocated objects. These objects can live beyond the current function, but their lifetime must be managed. In modern C++, prefer smart pointers instead of raw `new` and `delete`.

```cpp
#include <memory>

std::unique_ptr<Vec2> p = std::make_unique<Vec2>(1.0, 2.0);
```

Question: What is object lifetime?

Answer:

Object lifetime is the period during which an object is valid to use. Using a pointer or reference after the object has been destroyed is a serious bug.

Bad example:

```cpp
const Vec2& badReference() {
    Vec2 local{1.0, 2.0};
    return local;       // wrong: local dies when the function returns
}
```

Good example:

```cpp
Vec2 makePoint() {
    return Vec2{1.0, 2.0};
}
```

Question: What is copying vs referencing?

Answer:

Copying creates a separate object. Referencing uses the existing object.

```cpp
void byValue(Vec2 p) {      // copies the Vec2
    p.x = 10.0;             // modifies only the copy
}

void byReference(Vec2& p) { // uses the original Vec2
    p.x = 10.0;             // modifies the original
}

void byConstReference(const Vec2& p) { // uses the original, read-only
    std::cout << p.x << "\n";
}
```

Rule of thumb:

- Small cheap values like `int`, `double`, and simple enums: pass by value.
- Larger structs/classes that you only read: pass by `const T&`.
- Objects that must be modified: pass by `T&`.
- Optional object access: use `T*`, `std::optional<T>`, or a smart pointer depending on ownership.

Question: What is const correctness?

Answer:

`const` says a value should not be modified through this variable, pointer, reference, or member function. It makes code easier to reason about and helps the compiler catch mistakes.

```cpp
bool contains(const Box2D& box, const Vec2& p) {
    return p.x >= box.mn.x && p.x <= box.mx.x &&
           p.y >= box.mn.y && p.y <= box.mx.y;
}
```

Member functions can also be `const`:

```cpp
struct Box2D {
    Vec2 mn;
    Vec2 mx;

    double width() const {
        return mx.x - mn.x;
    }
};
```

The `const` after `width()` means this function does not modify the `Box2D`.

Question: What is null pointer risk?

Answer:

A raw pointer can be `nullptr`. Dereferencing a null pointer is undefined behavior and can crash the program.

Bad example:

```cpp
Vec2* p = nullptr;
p->x = 1.0;             // wrong
```

Better:

```cpp
void printPoint(const Vec2* p) {
    if (p == nullptr) {
        return;
    }

    std::cout << p->x << ", " << p->y << "\n";
}
```

If the function requires a valid object, prefer a reference:

```cpp
void printPoint(const Vec2& p) {
    std::cout << p.x << ", " << p.y << "\n";
}
```

Question: When should I use `std::unique_ptr`?

Answer:

Use `std::unique_ptr<T>` when one owner is responsible for a heap object, and that object should be destroyed automatically when the owner goes away.

Good use cases:

- A scene owns objects.
- A class owns an optional large resource.
- You need polymorphism through a base class pointer.
- You want heap allocation without manual `delete`.

Example:

```cpp
#include <memory>
#include <vector>

struct Object {
    virtual ~Object() = default;
    virtual void draw() const = 0;
};

std::vector<std::unique_ptr<Object>> objects;
```

Important rule:

- `std::unique_ptr` means single ownership.
- It cannot be copied.
- It can be moved.
- When the `unique_ptr` is destroyed, it deletes the object automatically.

Common graphics-style function:

```cpp
bool contains(const Box2D& box, const Vec2& p);
```

Why this style is common:

- `const` means the function will not modify the argument.
- `&` avoids copying the whole object.
- The function can read the object efficiently and safely.

### Stage 4: Standard Library First

Do not hand-write containers at the beginning. Use the standard library.

Prioritize:

```cpp
#include <vector>
#include <string>
#include <array>
#include <optional>
#include <algorithm>
#include <memory>
```

Common examples:

```cpp
std::vector<Vec2> points;
std::optional<Box2D> result;
std::array<Vec3, 3> axes;
std::unique_ptr<Object> object;

std::min(a, b);
std::max(a, b);
```

Key goal: express intent clearly before optimizing low-level details.

### Stage 5: Graphics Math Structures

Use this repository to practice C++ through graphics problems.

Suggested order:

1. `Vec2`
2. `Vec3`
3. `Ray`
4. `Box2D`
5. `AABB`
6. `OBB`
7. `Triangle`
8. `Matrix`
9. `Transform`
10. `Camera`
11. `Material`
12. `Scene`

For each type, practice:

- Fields
- Constructors
- Helper functions
- `const` member functions
- Tests or printed cases
- Edge cases

## Current Script Practice Path

Use the scripts in this order:

1. `01_bounding_box_2d.cpp`
   - Learn `struct`, constructors, `std::optional`, `const T&`, and simple geometry logic.

2. `02_ray_plane.cpp`
   - Learn functions, dot products, and solving equations in code.

3. `03_ray_triangle.cpp`
   - Learn multi-step algorithms and barycentric constraints.

4. `04_ray_aabb.cpp`
   - Learn slab intervals, edge cases, and ray-box tests.

5. `05_ray_obb.cpp`
   - Learn basis vectors, projection, and reusing an algorithm in a different coordinate frame.

6. `06_mvp_matrices.cpp`
   - Learn matrix composition and transform order.

7. `07_normal_matrix.cpp`
   - Learn why math correctness matters under non-uniform scaling.

8. `08_homogeneous_coords.cpp`
   - Learn `w`, points vs directions, and projection behavior.

## Daily Study Routine

Use a 60-90 minute loop:

1. Read for 15-20 minutes.
2. Write or modify one small C++ type for 25-35 minutes.
3. Compile and run for 15-20 minutes.
4. Fix compiler errors and warnings.
5. Write a short note with:
   - What type did I build?
   - Which functions used `const T&`?
   - Which cases failed first?
   - What edge case did I add?

Example daily task:

```cpp
struct Box2D {
    Vec2 mn;
    Vec2 mx;

    bool contains(const Vec2& p) const;
    bool overlaps(const Box2D& other) const;
};
```

## Weekly Goals

### Week 1: Basic C++ And Structs

- Write `Vec2`, `Vec3`, and `Box2D`.
- Use constructors.
- Use `std::vector`.
- Compile from the terminal.

### Week 2: Const, References, And Geometry Functions

- Rewrite functions to use `const T&`.
- Implement `contains`, `overlaps`, `unite`, and `intersection`.
- Return `std::optional<Box2D>` for invalid or empty results.

### Week 3: Ray Intersection Basics

- Implement ray-plane.
- Implement ray-AABB.
- Understand parallel ray cases.
- Explain `tNear`, `tFar`, and why `tExit < 0` means the hit is behind the ray.

### Week 4: Matrices And OpenGL Data Flow

- Understand model, view, projection.
- Implement simple matrix/vector multiplication.
- Explain local space, world space, view space, clip space, and NDC.

## What To Avoid Early

Avoid spending too much time on these before you can write small programs confidently:

- Template metaprogramming
- Manual memory allocators
- Complex inheritance hierarchies
- C-style arrays everywhere
- Premature performance tuning
- Reading large OpenGL projects before understanding small math scripts

## Practical Rule

For every concept, write code that compiles.

C++ is learned through the compiler. Reading syntax is useful, but the skill comes from writing code, seeing compiler errors, fixing them, and then explaining why the fix works.
