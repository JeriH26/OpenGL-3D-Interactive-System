// XR Viewer: same render loop as shader_app but with optional texture loading.
// Usage:
//   ./xr_viewer <fragment_shader.frag>
//   ./xr_viewer <fragment_shader.frag> --image <panorama.jpg>
//
// The loaded image is bound as sampler2D iChannel0 (texture unit 0).
// uniform float iHasTexture is set to 1.0 if an image was loaded, else 0.0.

#if defined(__APPLE__)
#include <OpenGL/gl3.h>
#include <GLFW/glfw3.h>
#else
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#endif

#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

#include "shader.h"
#include "frame_profiler.h"
#include "mouse_controller.h"

#include <iostream>
#include <string>

// ---------------------------------------------------------------------------
// GLFW callbacks (identical to main.cpp)
// ---------------------------------------------------------------------------
static MouseController g_mouseController;

static void framebuffer_size_callback(GLFWwindow*, int w, int h) {
    glViewport(0, 0, w, h);
}
static void cursor_pos_callback(GLFWwindow*, double x, double y) {
    g_mouseController.onCursorMove(x, y);
}
static void mouse_button_callback(GLFWwindow* window, int button, int action, int) {
    if (button == GLFW_MOUSE_BUTTON_LEFT) {
        if (action == GLFW_PRESS) {
            g_mouseController.onMouseButton(true);
            int ww, wh, fw, fh;
            glfwGetWindowSize(window, &ww, &wh);
            glfwGetFramebufferSize(window, &fw, &fh);
            g_mouseController.toggleLightByScreenClick((float)ww, (float)wh, (float)fw, (float)fh);
        } else if (action == GLFW_RELEASE) {
            g_mouseController.onMouseButton(false);
        }
    }
}
static void scroll_callback(GLFWwindow*, double, double yoff) {
    g_mouseController.onScroll(yoff);
}

// ---------------------------------------------------------------------------
// Texture helpers
// ---------------------------------------------------------------------------
static GLuint loadTexture(const std::string& path) {
    stbi_set_flip_vertically_on_load(true); // OpenGL origin = bottom-left
    int w, h, ch;
    unsigned char* data = stbi_load(path.c_str(), &w, &h, &ch, 0);
    if (!data) {
        std::cerr << "Failed to load image: " << path << "\n";
        return 0;
    }
    GLenum fmt = (ch == 4) ? GL_RGBA : GL_RGB;
    GLuint tex;
    glGenTextures(1, &tex);
    glBindTexture(GL_TEXTURE_2D, tex);
    glTexImage2D(GL_TEXTURE_2D, 0, fmt, w, h, 0, fmt, GL_UNSIGNED_BYTE, data);
    glGenerateMipmap(GL_TEXTURE_2D);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    stbi_image_free(data);
    std::cout << "Loaded texture: " << path << " (" << w << "x" << h << ", " << ch << "ch)\n";
    return tex;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "Usage: xr_viewer <fragment.frag> [--image <path.jpg>]\n";
        return 1;
    }

    std::string fragPath = argv[1];
    std::string imagePath;
    for (int i = 2; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--image" && i + 1 < argc) {
            imagePath = argv[++i];
        }
    }

    if (!glfwInit()) return -1;
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

    GLFWwindow* window = glfwCreateWindow(1200, 600, "XR Viewer", nullptr, nullptr);
    if (!window) { glfwTerminate(); return -1; }
    glfwMakeContextCurrent(window);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetCursorPosCallback(window, cursor_pos_callback);
    glfwSetMouseButtonCallback(window, mouse_button_callback);
    glfwSetScrollCallback(window, scroll_callback);

#if !defined(__APPLE__)
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
        std::cerr << "Failed to initialize GLAD\n";
        return -1;
    }
#endif

    const char* vertexSrc = R"GLSL(
#version 330 core
layout(location = 0) in vec2 aPos;
out vec2 vUV;
void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
)GLSL";

    GLuint program = createProgramFromFiles(vertexSrc, fragPath);
    if (!program) {
        std::cerr << "Failed to create shader program\n";
        glfwTerminate();
        return -1;
    }

    // Texture setup
    GLuint texID = 0;
    bool texLoaded = false;
    if (!imagePath.empty()) {
        texID = loadTexture(imagePath);
        texLoaded = (texID != 0);
    }

    // Bind iChannel0 to texture unit 0 (set once; persists in program state)
    glUseProgram(program);
    GLint ch0Loc = glGetUniformLocation(program, "iChannel0");
    if (ch0Loc >= 0) glUniform1i(ch0Loc, 0);

    // Fullscreen quad
    float quad[] = { -1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1 };
    GLuint VAO, VBO;
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);
    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(quad), quad, GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), nullptr);

    std::cout << "XR Viewer ready. Drag mouse to look around. Scroll to zoom.\n";
    if (!texLoaded) std::cout << "No image loaded — procedural mode.\n";

    while (!glfwWindowShouldClose(window)) {
        int w, h;
        glfwGetFramebufferSize(window, &w, &h);
        glViewport(0, 0, w, h);
        glClear(GL_COLOR_BUFFER_BIT);

        glUseProgram(program);

        // Standard Shadertoy-style uniforms
        GLint resLoc  = glGetUniformLocation(program, "iResolution");
        GLint timeLoc = glGetUniformLocation(program, "iTime");
        GLint mouseLoc = glGetUniformLocation(program, "iMouse");
        GLint orbitLoc = glGetUniformLocation(program, "iOrbit");
        GLint distLoc  = glGetUniformLocation(program, "iDistance");
        GLint hasTexLoc = glGetUniformLocation(program, "iHasTexture");

        if (resLoc  >= 0) glUniform3f(resLoc, (float)w, (float)h, 1.0f);
        if (timeLoc >= 0) glUniform1f(timeLoc, (float)glfwGetTime());
        if (orbitLoc >= 0) glUniform2f(orbitLoc, g_mouseController.getYaw(), g_mouseController.getPitch());
        if (distLoc  >= 0) glUniform1f(distLoc, g_mouseController.getDistance());
        if (hasTexLoc >= 0) glUniform1f(hasTexLoc, texLoaded ? 1.0f : 0.0f);
        if (mouseLoc >= 0) {
            float im[4] = {};
            g_mouseController.buildIMouse((float)h, im);
            glUniform4f(mouseLoc, im[0], im[1], im[2], im[3]);
        }

        // Bind texture
        glActiveTexture(GL_TEXTURE0);
        if (texLoaded)
            glBindTexture(GL_TEXTURE_2D, texID);

        glBindVertexArray(VAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);

        glfwSwapBuffers(window);
        glfwPollEvents();

        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
            glfwSetWindowShouldClose(window, GLFW_TRUE);
    }

    if (texID) glDeleteTextures(1, &texID);
    glDeleteProgram(program);
    glDeleteBuffers(1, &VBO);
    glDeleteVertexArrays(1, &VAO);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
