cmake_minimum_required(VERSION 3.14)
project(ShaderAnimation)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

FetchContent_Declare(
  glfw
  GIT_REPOSITORY https://github.com/glfw/glfw.git
  GIT_TAG 3.3.8
)
FetchContent_MakeAvailable(glfw)

FetchContent_Declare(
  stb
  GIT_REPOSITORY https://github.com/nothings/stb.git
  GIT_TAG master
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(stb)

add_executable(shader_app
  src/app_options.cpp
  src/frame_profiler.cpp
  src/main.cpp
  src/performance_profiler.cpp
  src/shader.cpp
  src/mouse_controller.cpp
)

target_link_libraries(shader_app PRIVATE glfw)

# Unit tests for mouse controller
add_executable(mouse_controller_test
  src/mouse_controller.cpp
  src/mouse_controller_test.cpp
)

enable_testing()
add_test(NAME MouseControllerTest COMMAND mouse_controller_test)

# XR viewer: same as shader_app but adds texture loading via stb_image
add_executable(xr_viewer
  src/xr_viewer.cpp
  src/frame_profiler.cpp
  src/shader.cpp
  src/mouse_controller.cpp
  src/app_options.cpp
  src/performance_profiler.cpp
)
target_include_directories(xr_viewer PRIVATE ${stb_SOURCE_DIR})
target_link_libraries(xr_viewer PRIVATE glfw)

if(NOT APPLE)
  message(WARNING "Non-Apple platforms currently require GLAD; please add a loader or enable FetchContent for GLAD.")
endif()

if(APPLE)
  find_library(COCOA_LIBRARY Cocoa)
  find_library(IOKIT_LIBRARY IOKit)
  find_library(COREVIDEO_LIBRARY CoreVideo)
  find_library(OPENGL_LIBRARY OpenGL)
  target_link_libraries(shader_app PRIVATE ${COCOA_LIBRARY} ${IOKIT_LIBRARY} ${COREVIDEO_LIBRARY} ${OPENGL_LIBRARY})
  target_link_libraries(xr_viewer PRIVATE ${COCOA_LIBRARY} ${IOKIT_LIBRARY} ${COREVIDEO_LIBRARY} ${OPENGL_LIBRARY})
endif()
