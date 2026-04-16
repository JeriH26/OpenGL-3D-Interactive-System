#if defined(__APPLE__)
#include <OpenGL/gl3.h>
#include <GLFW/glfw3.h>
#else
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#endif
#include "shader.h"
#include "app_options.h"
#include "frame_profiler.h"
#include "mouse_controller.h"

#include <iostream>

static void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
    glViewport(0, 0, width, height);
}

// Global mouse controller
static MouseController g_mouseController;
static int g_noiseMode = 0;

static bool handleNoiseModeClick(GLFWwindow* window, double xpos, double ypos) {
    int ww = 0, wh = 0;
    glfwGetWindowSize(window, &ww, &wh);
    if (ww <= 0 || wh <= 0) return false;

    // Match shader overlay geometry: top-left buttons in normalized screen space.
    const float panelX = 0.018f;
    const float panelY = 0.926f;
    const float bw = 0.070f;
    const float bh = 0.052f;
    const float gap = 0.010f;

    float x = static_cast<float>(xpos) / static_cast<float>(ww);
    float y = 1.0f - static_cast<float>(ypos) / static_cast<float>(wh);

    for (int i = 0; i < 3; ++i) {
        float bx0 = panelX + i * (bw + gap);
        float by0 = panelY;
        float bx1 = bx0 + bw;
        float by1 = by0 + bh;
        if (x >= bx0 && x <= bx1 && y >= by0 && y <= by1) {
            g_noiseMode = i;
            std::cout << "Noise mode set to: " << g_noiseMode << std::endl;
            return true;
        }
    }
    return false;
}

static void cursor_pos_callback(GLFWwindow* window, double xpos, double ypos) {
    (void)window;
    g_mouseController.onCursorMove(xpos, ypos);
}

static void mouse_button_callback(GLFWwindow* window, int button, int action, int mods) {
    (void)window;
    (void)mods;
    if (button == GLFW_MOUSE_BUTTON_LEFT) {
        if (action == GLFW_PRESS) {
            double xpos = 0.0, ypos = 0.0;
            glfwGetCursorPos(window, &xpos, &ypos);
            if (handleNoiseModeClick(window, xpos, ypos)) {
                return;
            }

            g_mouseController.onMouseButton(true);
            int ww = 0, wh = 0;
            int w = 0, h = 0;
            glfwGetWindowSize(window, &ww, &wh);
            glfwGetFramebufferSize(window, &w, &h);
            g_mouseController.toggleLightByScreenClick((float)ww, (float)wh, (float)w, (float)h);
            std::cout << "MOUSE PRESS at: " << g_mouseController.getCursorX() << "," << g_mouseController.getCursorY() << std::endl;
        } else if (action == GLFW_RELEASE) {
            g_mouseController.onMouseButton(false);
            std::cout << "MOUSE RELEASE at: " << g_mouseController.getCursorX() << "," << g_mouseController.getCursorY() << std::endl;
        }
    }
}

static void scroll_callback(GLFWwindow* window, double xoffset, double yoffset) {
    (void)window;
    (void)xoffset;
    g_mouseController.onScroll(yoffset);
}

int main(int argc, char** argv) {
    AppOptions options;
    ParseStatus parseStatus = parseAppOptions(argc, argv, options);
    if (parseStatus == ParseStatus::ExitSuccess) return 0;
    if (parseStatus == ParseStatus::ExitFailure) return 1;

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

    GLFWwindow* window = glfwCreateWindow(800, 600, "Shader Runner", nullptr, nullptr);
    if (!window) { glfwTerminate(); return -1; }
    glfwMakeContextCurrent(window);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetCursorPosCallback(window, cursor_pos_callback);
    glfwSetMouseButtonCallback(window, mouse_button_callback);
    glfwSetScrollCallback(window, scroll_callback);

    #if !defined(__APPLE__)
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
        std::cerr << "Failed to initialize GLAD" << std::endl;
        return -1;
    }
    #endif

    FrameProfiler profiler(options.profilerConfig);
    profiler.initialize();

    const char* vertexSrc = R"GLSL(#version 330 core
layout(location = 0) in vec2 aPos;
out vec2 vUV;
void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
)GLSL";

    GLuint program = createProgramFromFiles(vertexSrc, options.fragPath.c_str());
    if (!program) {
        std::cerr << "Failed to create shader program" << std::endl;
        return -1;
    }

    float quad[] = {
        -1.0f, -1.0f,
         1.0f, -1.0f,
        -1.0f,  1.0f,
        -1.0f,  1.0f,
         1.0f, -1.0f,
         1.0f,  1.0f
    };

    GLuint VAO, VBO;
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);
    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(quad), quad, GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)0);

    while (!glfwWindowShouldClose(window)) {
        profiler.beginFrame();
        int w, h; glfwGetFramebufferSize(window, &w, &h);
        glViewport(0, 0, w, h);
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);

        glUseProgram(program);
        GLint resLoc = glGetUniformLocation(program, "iResolution");
        GLint timeLoc = glGetUniformLocation(program, "iTime");
        GLint mouseLoc = glGetUniformLocation(program, "iMouse");
        GLint orbitLoc = glGetUniformLocation(program, "iOrbit");
        GLint lightToggleLoc = glGetUniformLocation(program, "iLightOn");
        GLint distanceLoc = glGetUniformLocation(program, "iDistance");
        GLint noiseModeLoc = glGetUniformLocation(program, "iNoiseMode");
        if (resLoc >= 0) glUniform3f(resLoc, (float)w, (float)h, 1.0f);
        if (timeLoc >= 0) glUniform1f(timeLoc, (float)glfwGetTime());
        if (orbitLoc >= 0) glUniform2f(orbitLoc, g_mouseController.getYaw(), g_mouseController.getPitch());
        if (lightToggleLoc >= 0) glUniform1f(lightToggleLoc, g_mouseController.isLightEnabled() ? 1.0f : 0.0f);
        if (distanceLoc >= 0) glUniform1f(distanceLoc, g_mouseController.getDistance());
        if (noiseModeLoc >= 0) glUniform1i(noiseModeLoc, g_noiseMode);
        if (mouseLoc >= 0) {
            float iMouse[4] = {0.0f, 0.0f, 0.0f, 0.0f};
            g_mouseController.buildIMouse((float)h, iMouse);
            glUniform4f(mouseLoc, iMouse[0], iMouse[1], iMouse[2], iMouse[3]);
        }

        glBindVertexArray(VAO);
        profiler.beginGpuTiming();
        glDrawArrays(GL_TRIANGLES, 0, 6);
        profiler.endGpuTiming();
        profiler.markCpuSubmitEnd();

        profiler.markSwapBegin();
        glfwSwapBuffers(window);
        profiler.markSwapEnd();
        glfwPollEvents();
        profiler.markEventPollEnd();
        profiler.endFrame();

        if (profiler.shouldStop()) glfwSetWindowShouldClose(window, GLFW_TRUE);
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) glfwSetWindowShouldClose(window, GLFW_TRUE);
    }

    profiler.finalize();
    glDeleteProgram(program);
    glDeleteBuffers(1, &VBO);
    glDeleteVertexArrays(1, &VAO);
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
