#include "shader.h"

#include <fstream>
#include <sstream>
#include <iostream>

static void checkCompile(GLuint shader, const std::string &label) {
    GLint success;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
    if (!success) {
        GLint len = 0; glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &len);
        std::string log(len, '\0');
        glGetShaderInfoLog(shader, len, nullptr, &log[0]);
        std::cerr << label << " compile error:\n" << log << std::endl;
    }
}

static void checkLink(GLuint prog) {
    GLint success; glGetProgramiv(prog, GL_LINK_STATUS, &success);
    if (!success) {
        GLint len = 0; glGetProgramiv(prog, GL_INFO_LOG_LENGTH, &len);
        std::string log(len, '\0');
        glGetProgramInfoLog(prog, len, nullptr, &log[0]);
        std::cerr << "Link error:\n" << log << std::endl;
    }
}

std::string readFileToString(const std::string &path) {
    std::ifstream ifs(path);
    if (!ifs) {
        std::cerr << "Failed to open file: " << path << std::endl;
        return std::string();
    }
    std::stringstream ss; ss << ifs.rdbuf();
    return ss.str();
}

GLuint createProgramFromFiles(const char *vertexSource, const std::string &fragPath) {
    std::string fragSrc = readFileToString(fragPath);
    if (fragSrc.empty()) return 0;

    // Combine a small compatibility wrapper for Shadertoy-style shaders.
    std::string finalFrag;
    finalFrag += "#version 330 core\n";
    finalFrag += "out vec4 FragColor;\n";
    finalFrag += "uniform vec3 iResolution;\n";
    finalFrag += "uniform float iTime;\n";
    finalFrag += "uniform vec4 iMouse;\n";
    finalFrag += "uniform int iNoiseMode;\n";
    finalFrag += "\n";
    finalFrag += fragSrc;
    finalFrag += "\nvoid main(){ vec2 fragCoord = gl_FragCoord.xy; vec4 col = vec4(0.0); mainImage(col, fragCoord); FragColor = col; }\n";

    GLuint vert = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(vert, 1, &vertexSource, nullptr);
    glCompileShader(vert);
    checkCompile(vert, "Vertex");

    const char *fragCStr = finalFrag.c_str();
    GLuint frag = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(frag, 1, &fragCStr, nullptr);
    glCompileShader(frag);
    checkCompile(frag, "Fragment");

    GLuint prog = glCreateProgram();
    glAttachShader(prog, vert);
    glAttachShader(prog, frag);
    glLinkProgram(prog);
    checkLink(prog);

    glDeleteShader(vert);
    glDeleteShader(frag);
    return prog;
}
