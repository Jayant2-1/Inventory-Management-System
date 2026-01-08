#!/bin/bash

echo "Building high-performance inventory system for macOS..."

# Get number of CPU cores for macOS
NUM_CORES=$(sysctl -n hw.ncpu)
echo "Using $NUM_CORES CPU cores"

# Create build directory
mkdir -p core/build
cd core/build

# Configure with CMake
cmake ..

# Build
make -j$NUM_CORES

# Copy to backend
cp inventory_core* ../../backend/

echo "Build completed successfully!"
echo "C++ extension copied to backend directory"

# List the built file to verify
echo "Built file:"
ls -la ../../backend/inventory_core*