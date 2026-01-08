#!/bin/bash

echo "Buil# Get Python library flags
PYTHON_CONFIG=$(which python3-config)
PYTHON_LIBS=$($PYTHON_CONFIG --ldflags)

# Compile directly with proper path handling and Python linking
c++ -O3 -Wall -shared -std=c++17 -fPIC \
    "-I../" \
    "-I$PYTHON_INCLUDE" \
    "-I$PYBIND11_INCLUDE" \
    ../wrapper.cpp ../bst.cpp \
    $PYTHON_LIBS \
    -o "inventory_core$EXT_SUFFIX"nventory system using direct compilation..."

# Get Python include path
PYTHON_INCLUDE=$(python3 -c "import sysconfig; print(sysconfig.get_path('include'))")
PYTHON_LIB=$(python3 -c "import sysconfig; print(sysconfig.get_config_var('LIBDIR'))")

# Get pybind11 include path
PYBIND11_INCLUDE=$(python3 -c "import pybind11; print(pybind11.get_include())")

# Get the Python extension suffix
EXT_SUFFIX=$(python3 -c "import sysconfig; print(sysconfig.get_config_var('EXT_SUFFIX'))")

echo "Python include: $PYTHON_INCLUDE"
echo "Python lib: $PYTHON_LIB"
echo "PyBind11 include: $PYBIND11_INCLUDE"

# Create build directory
mkdir -p core/build
cd core/build

# Compile directly
c++ -O3 -Wall -shared -std=c++17 -fPIC \
    "-I../" \
    "-I$PYTHON_INCLUDE" \
    "-I$PYBIND11_INCLUDE" \
    ../wrapper.cpp ../bst.cpp \
    -o "inventory_core$EXT_SUFFIX"

# Check if compilation was successful
if [ $? -eq 0 ]; then
    echo "Compilation successful!"
    # Copy to backend
    cp inventory_core* ../../backend/
    echo "Built files:"
    ls -la inventory_core*
else
    echo "Compilation failed!"
    exit 1
fi