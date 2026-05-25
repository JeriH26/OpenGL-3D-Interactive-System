// ================================================================
// 01_bounding_box_2d_visual.cpp
// A tiny visual playground for 2D AABB ideas.
//
// Move the mouse: the small box follows the cursor.
// Space: toggle whether the mouse box is locked/follows cursor.
// R: reset the fixed boxes.
// Esc: quit.
// ================================================================

#if defined(__APPLE__)
#include <OpenGL/gl3.h>
#include <GLFW/glfw3.h>
#else
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#endif

#include <algorithm>
#include <cmath>
#include <iostream>
#include <optional>
#include <string>
#include <vector>

struct Vec2 {
    float x = 0.0f;
    float y = 0.0f;

    Vec2() = default;
    Vec2(float x_, float y_) : x(x_), y(y_) {}

    Vec2 operator+(const Vec2& r) const { return {x + r.x, y + r.y}; }
};

struct Box2D {
    Vec2 mn;
    Vec2 mx;

    Box2D() = default;

    Box2D(const Vec2& topLeft, const Vec2& size) {
        Vec2 bottomRight = topLeft + size;
        mn = {std::min(topLeft.x, bottomRight.x), std::min(topLeft.y, bottomRight.y)};
        mx = {std::max(topLeft.x, bottomRight.x), std::max(topLeft.y, bottomRight.y)};
    }

    static Box2D fromMinMax(const Vec2& minCorner, const Vec2& maxCorner) {
        Box2D b;
        b.mn = {std::min(minCorner.x, maxCorner.x), std::min(minCorner.y, maxCorner.y)};
        b.mx = {std::max(minCorner.x, maxCorner.x), std::max(minCorner.y, maxCorner.y)};
        return b;
    }

    float width() const { return mx.x - mn.x; }
    float height() const { return mx.y - mn.y; }
};

static bool contains(const Box2D& box, const Vec2& p) {
    return p.x >= box.mn.x && p.x <= box.mx.x &&
           p.y >= box.mn.y && p.y <= box.mx.y;
}

static bool overlaps(const Box2D& a, const Box2D& b) {
    return !(a.mx.x < b.mn.x ||
             a.mn.x > b.mx.x ||
             a.mx.y < b.mn.y ||
             a.mn.y > b.mx.y);
}

static std::optional<Box2D> intersection(const Box2D& a, const Box2D& b) {
    Vec2 mn{std::max(a.mn.x, b.mn.x), std::max(a.mn.y, b.mn.y)};
    Vec2 mx{std::min(a.mx.x, b.mx.x), std::min(a.mx.y, b.mx.y)};

    if (mn.x > mx.x || mn.y > mx.y) return std::nullopt;
    return Box2D::fromMinMax(mn, mx);
}

struct Color {
    float r = 1.0f;
    float g = 1.0f;
    float b = 1.0f;
    float a = 1.0f;
};

struct Vertex {
    float x = 0.0f;
    float y = 0.0f;
    float r = 1.0f;
    float g = 1.0f;
    float b = 1.0f;
    float a = 1.0f;
};

static int g_windowWidth = 900;
static int g_windowHeight = 650;
static Vec2 g_mouse{450.0f, 325.0f};
static Vec2 g_lockedMouse{450.0f, 325.0f};
static bool g_followMouse = true;
static bool g_spaceWasDown = false;
static bool g_rWasDown = false;

static GLuint compileShader(GLenum type, const char* source) {
    GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);

    GLint ok = GL_FALSE;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        char log[1024];
        glGetShaderInfoLog(shader, sizeof(log), nullptr, log);
        std::cerr << "Shader compile failed: " << log << "\n";
        glDeleteShader(shader);
        return 0;
    }
    return shader;
}

static GLuint createProgram() {
    const char* vertexSrc = R"GLSL(#version 330 core
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aColor;
out vec4 vColor;
uniform vec2 uResolution;
void main() {
    vec2 ndc = vec2((aPos.x / uResolution.x) * 2.0 - 1.0,
                    1.0 - (aPos.y / uResolution.y) * 2.0);
    gl_Position = vec4(ndc, 0.0, 1.0);
    vColor = aColor;
}
)GLSL";

    const char* fragmentSrc = R"GLSL(#version 330 core
in vec4 vColor;
out vec4 FragColor;
void main() {
    FragColor = vColor;
}
)GLSL";

    GLuint vs = compileShader(GL_VERTEX_SHADER, vertexSrc);
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, fragmentSrc);
    if (!vs || !fs) return 0;

    GLuint program = glCreateProgram();
    glAttachShader(program, vs);
    glAttachShader(program, fs);
    glLinkProgram(program);
    glDeleteShader(vs);
    glDeleteShader(fs);

    GLint ok = GL_FALSE;
    glGetProgramiv(program, GL_LINK_STATUS, &ok);
    if (!ok) {
        char log[1024];
        glGetProgramInfoLog(program, sizeof(log), nullptr, log);
        std::cerr << "Program link failed: " << log << "\n";
        glDeleteProgram(program);
        return 0;
    }
    return program;
}

static void addVertex(std::vector<Vertex>& vertices, Vec2 p, Color c) {
    vertices.push_back({p.x, p.y, c.r, c.g, c.b, c.a});
}

static void addFilledRect(std::vector<Vertex>& vertices, const Box2D& box, Color c) {
    Vec2 a{box.mn.x, box.mn.y};
    Vec2 b{box.mx.x, box.mn.y};
    Vec2 c0{box.mx.x, box.mx.y};
    Vec2 d{box.mn.x, box.mx.y};

    addVertex(vertices, a, c);
    addVertex(vertices, b, c);
    addVertex(vertices, c0, c);
    addVertex(vertices, a, c);
    addVertex(vertices, c0, c);
    addVertex(vertices, d, c);
}

static void addLineRect(std::vector<Vertex>& vertices, const Box2D& box, Color c) {
    Vec2 a{box.mn.x, box.mn.y};
    Vec2 b{box.mx.x, box.mn.y};
    Vec2 c0{box.mx.x, box.mx.y};
    Vec2 d{box.mn.x, box.mx.y};

    addVertex(vertices, a, c);
    addVertex(vertices, b, c);
    addVertex(vertices, b, c);
    addVertex(vertices, c0, c);
    addVertex(vertices, c0, c);
    addVertex(vertices, d, c);
    addVertex(vertices, d, c);
    addVertex(vertices, a, c);
}

static void addCross(std::vector<Vertex>& vertices, Vec2 p, float radius, Color c) {
    addVertex(vertices, {p.x - radius, p.y}, c);
    addVertex(vertices, {p.x + radius, p.y}, c);
    addVertex(vertices, {p.x, p.y - radius}, c);
    addVertex(vertices, {p.x, p.y + radius}, c);
}

static void framebufferSizeCallback(GLFWwindow*, int width, int height) {
    g_windowWidth = std::max(width, 1);
    g_windowHeight = std::max(height, 1);
    glViewport(0, 0, g_windowWidth, g_windowHeight);
}

static void cursorPosCallback(GLFWwindow*, double x, double y) {
    g_mouse = {static_cast<float>(x), static_cast<float>(y)};
}

static Box2D makeMouseBox() {
    Vec2 size{120.0f, 90.0f};
    Vec2 center = g_followMouse ? g_mouse : g_lockedMouse;
    return Box2D({center.x - size.x * 0.5f, center.y - size.y * 0.5f}, size);
}

static void updateTitle(GLFWwindow* window, bool hitA, bool hitB, bool mouseInsideA) {
    std::string title = "AABB Visualizer | overlap A: ";
    title += hitA ? "true" : "false";
    title += " | overlap B: ";
    title += hitB ? "true" : "false";
    title += " | mouse in A: ";
    title += mouseInsideA ? "true" : "false";
    title += " | Space lock/follow | R reset";
    glfwSetWindowTitle(window, title.c_str());
}

static void handleKeys(GLFWwindow* window) {
    bool spaceDown = glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_PRESS;
    if (spaceDown && !g_spaceWasDown) {
        if (g_followMouse) {
            g_lockedMouse = g_mouse;
        }
        g_followMouse = !g_followMouse;
    }
    g_spaceWasDown = spaceDown;

    bool rDown = glfwGetKey(window, GLFW_KEY_R) == GLFW_PRESS;
    if (rDown && !g_rWasDown) {
        g_mouse = {450.0f, 325.0f};
        g_lockedMouse = g_mouse;
        g_followMouse = true;
    }
    g_rWasDown = rDown;

    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
    }
}

int main() {
    if (!glfwInit()) return 1;

#if defined(__APPLE__)
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 2);
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
#else
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
#endif

    GLFWwindow* window = glfwCreateWindow(
        g_windowWidth,
        g_windowHeight,
        "AABB Visualizer",
        nullptr,
        nullptr
    );
    if (!window) {
        glfwTerminate();
        return 1;
    }

    glfwMakeContextCurrent(window);
    glfwSwapInterval(1);
    glfwSetFramebufferSizeCallback(window, framebufferSizeCallback);
    glfwSetCursorPosCallback(window, cursorPosCallback);

#if !defined(__APPLE__)
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
        std::cerr << "Failed to initialize GLAD\n";
        return 1;
    }
#endif

    GLuint program = createProgram();
    if (!program) {
        glfwTerminate();
        return 1;
    }

    GLuint vao = 0;
    GLuint vbo = 0;
    glGenVertexArrays(1, &vao);
    glGenBuffers(1, &vbo);
    glBindVertexArray(vao);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, 4096 * sizeof(Vertex), nullptr, GL_DYNAMIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), reinterpret_cast<void*>(0));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 4, GL_FLOAT, GL_FALSE, sizeof(Vertex), reinterpret_cast<void*>(2 * sizeof(float)));

    Box2D fixedA({170.0f, 170.0f}, {260.0f, 180.0f});
    Box2D fixedB({520.0f, 300.0f}, {190.0f, 150.0f});

    while (!glfwWindowShouldClose(window)) {
        handleKeys(window);

        Box2D mouseBox = makeMouseBox();

        bool hitA = overlaps(mouseBox, fixedA);
        bool hitB = overlaps(mouseBox, fixedB);
        bool mouseInsideA = contains(fixedA, g_mouse);
        updateTitle(window, hitA, hitB, mouseInsideA);

        std::vector<Vertex> triangles;
        std::vector<Vertex> lines;

        addFilledRect(triangles, fixedA, {0.15f, 0.35f, 0.95f, 0.25f});
        addFilledRect(triangles, fixedB, {0.10f, 0.70f, 0.42f, 0.25f});

        Color mouseFill = (hitA || hitB)
            ? Color{1.0f, 0.18f, 0.12f, 0.35f}
            : Color{1.0f, 0.74f, 0.20f, 0.35f};
        addFilledRect(triangles, mouseBox, mouseFill);

        if (auto r = intersection(mouseBox, fixedA)) {
            addFilledRect(triangles, *r, {1.0f, 1.0f, 1.0f, 0.45f});
        }
        if (auto r = intersection(mouseBox, fixedB)) {
            addFilledRect(triangles, *r, {1.0f, 1.0f, 1.0f, 0.45f});
        }

        addLineRect(lines, fixedA, hitA ? Color{1.0f, 1.0f, 1.0f, 1.0f} : Color{0.45f, 0.65f, 1.0f, 1.0f});
        addLineRect(lines, fixedB, hitB ? Color{1.0f, 1.0f, 1.0f, 1.0f} : Color{0.45f, 1.0f, 0.65f, 1.0f});
        addLineRect(lines, mouseBox, (hitA || hitB) ? Color{1.0f, 0.12f, 0.10f, 1.0f} : Color{1.0f, 0.78f, 0.20f, 1.0f});
        addCross(lines, g_mouse, 10.0f, mouseInsideA ? Color{1.0f, 1.0f, 1.0f, 1.0f} : Color{0.95f, 0.95f, 0.95f, 0.75f});

        glViewport(0, 0, g_windowWidth, g_windowHeight);
        glClearColor(0.06f, 0.07f, 0.08f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);

        glUseProgram(program);
        GLint resLoc = glGetUniformLocation(program, "uResolution");
        if (resLoc >= 0) {
            glUniform2f(resLoc, static_cast<float>(g_windowWidth), static_cast<float>(g_windowHeight));
        }

        glBindVertexArray(vao);
        glBindBuffer(GL_ARRAY_BUFFER, vbo);

        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

        if (!triangles.empty()) {
            glBufferSubData(GL_ARRAY_BUFFER, 0, triangles.size() * sizeof(Vertex), triangles.data());
            glDrawArrays(GL_TRIANGLES, 0, static_cast<GLsizei>(triangles.size()));
        }

        glLineWidth(2.0f);
        if (!lines.empty()) {
            glBufferSubData(GL_ARRAY_BUFFER, 0, lines.size() * sizeof(Vertex), lines.data());
            glDrawArrays(GL_LINES, 0, static_cast<GLsizei>(lines.size()));
        }

        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    glDeleteBuffers(1, &vbo);
    glDeleteVertexArrays(1, &vao);
    glDeleteProgram(program);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
