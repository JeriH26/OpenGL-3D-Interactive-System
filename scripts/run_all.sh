#!/bin/bash
# ================================================================
# run_all.sh  -- Compile and run ALL graphics learning scripts
# Usage: ./scripts/run_all.sh           (run everything)
#        ./scripts/run_all.sh 06        (run only script 06_*)
#        ./scripts/run_all.sh pbr       (run scripts matching "pbr")
# ================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/../build/learning_scripts"
mkdir -p "$BUILD_DIR"

# Colors for output
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

FILTER="${1:-}"

SCRIPTS=(
    "ray_sphere_learning"
    "01_bounding_box_2d"
    "02_ray_plane"
    "03_ray_triangle"
    "04_ray_aabb"
    "05_ray_obb"
    "06_mvp_matrices"
    "07_normal_matrix"
    "08_homogeneous_coords"
    "09_phong_blinnphong"
    "10_pbr_basics"
    "11_shadow_map"
    "12_cross_product"
    "13_barycentric"
    "14_rotation_quaternion"
    "15_interpolation"
    "16_depth_buffer"
    "17_alpha_blending"
    "18_mipmap"
    "19_bvh_simple"
    "20_advanced_concepts"
)

PASS=0; FAIL=0; SKIP=0

for name in "${SCRIPTS[@]}"; do
    src="$SCRIPT_DIR/${name}.cpp"

    # Apply filter if provided
    if [[ -n "$FILTER" && "$name" != *"$FILTER"* ]]; then
        ((SKIP++)) || true
        continue
    fi

    if [[ ! -f "$src" ]]; then
        echo -e "${RED}[MISSING] ${name}.cpp${RESET}"
        ((FAIL++)) || true
        continue
    fi

    binary="$BUILD_DIR/$name"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${CYAN}${BOLD} $name${RESET}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

    # Compile
    if ! clang++ -std=c++17 -O2 -Wall -Wextra -Wno-unused-parameter \
                 -o "$binary" "$src" 2>&1; then
        echo -e "\n${RED}[COMPILE FAILED] $name${RESET}\n"
        ((FAIL++)) || true
        continue
    fi

    # Run
    if "$binary"; then
        echo -e "\n${GREEN}[DONE] $name${RESET}\n"
        ((PASS++)) || true
    else
        echo -e "\n${RED}[RUNTIME ERROR] $name  (exit code $?)${RESET}\n"
        ((FAIL++)) || true
    fi
done

echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD} Summary: ${GREEN}${PASS} passed${RESET}  ${RED}${FAIL} failed${RESET}  (${SKIP} skipped)${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
