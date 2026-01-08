cmake_minimum_required(VERSION 3.15)
project(InventoryCore)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Try to find pybind11 using different methods
find_package(pybind11 QUIET)
if(NOT pybind11_FOUND)
    # Try to find via Python package
    execute_process(
        COMMAND python -c "import pybind11; print(pybind11.get_cmake_dir())"
        OUTPUT_VARIABLE PY11_CMAKE_DIR
        OUTPUT_STRIP_TRAILING_WHITESPACE
        RESULT_VARIABLE PY11_RESULT
    )
    
    if(PY11_RESULT EQUAL 0)
        list(APPEND CMAKE_PREFIX_PATH ${PY11_CMAKE_DIR})
        find_package(pybind11 REQUIRED)
    else()
        # Fallback: use pkg-config
        find_package(PkgConfig REQUIRED)
        pkg_check_modules(PY11 pybind11)
        if(PY11_FOUND)
            add_library(pybind11 INTERFACE)
            target_include_directories(pybind11 INTERFACE ${PY11_INCLUDE_DIRS})
        else()
            message(FATAL_ERROR "pybind11 not found! Install with: brew install pybind11")
        endif()
    endif()
endif()

# Find Python
find_package(Python REQUIRED COMPONENTS Development.Module)

# Create Python module
pybind11_add_module(inventory_core 
    wrapper.cpp
    bst.cpp
)

# Optimize for performance
if(MSVC)
    target_compile_options(inventory_core PRIVATE /O2)
else()
    target_compile_options(inventory_core PRIVATE -O3)
endif()

# Set output name
set_target_properties(inventory_core PROPERTIES OUTPUT_NAME "inventory_core")