import { BaseRenderer } from "./baseRenderer.js";
import { GridRenderModes } from "./gridRenderModes.js";

class GridRenderer extends BaseRenderer {
  constructor(gl, shaderManager) {
    super(gl, shaderManager);
    this.vertexBuffer = gl.createBuffer();
    this.boundaryBuffer = gl.createBuffer();

    // Grid layout parameters
    this.rowCounts = [13, 19, 23, 25, 27, 29, 29, 29, 29, 27, 25, 23, 19, 13];
    this.numX = Math.max(...this.rowCounts);
    this.numY = this.rowCounts.length;

    // Base scale on 240x240 grid
    const scale = Math.min(gl.canvas.width, gl.canvas.height) / 240;

    // Cell dimensions
    this.rectWidth = 6 * scale;
    this.rectHeight = 15 * scale;
    this.stepX = 8 * scale;
    this.stepY = 17 * scale;

    // Create grid geometry
    this.createGridGeometry();

    // Add density field parameters with defaults
    this.density = new Float32Array(this.getTotalCells());
    this.minDensity = 0.0;
    this.maxDensity = 7.0;

    this.gradientPoints = [
      { pos: 0, color: { r: 0, g: 0, b: 0 } },
      { pos: 30, color: { r: 0.4, g: 0, b: 0 } },
      { pos: 60, color: { r: 1, g: 0, b: 0 } },
      { pos: 97, color: { r: 0.992, g: 1, b: 0.5 } },
      { pos: 100, color: { r: 1, g: 1, b: 1 } },
    ];
    this.gradient = this.createGradient();
    this.showDensity = true;

    this.renderModes = new GridRenderModes({
      rowCounts: this.rowCounts,
      numX: this.numX,
      numY: this.numY,
      stepX: this.stepX,
      stepY: this.stepY,
      canvas: this.gl.canvas,
    });

    console.log("GridRenderer initialized with scale:", scale);
  }

  getTotalCells() {
    return this.rowCounts.reduce((sum, count) => sum + count, 0);
  }

  createGradient() {
    const gradient = new Array(256).fill(0).map(() => ({ r: 0, g: 0, b: 0 }));

    // Interpolate between control points
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let lower = this.gradientPoints[0];
      let upper = this.gradientPoints[this.gradientPoints.length - 1];

      // Find the two points to interpolate between
      for (let j = 0; j < this.gradientPoints.length - 1; j++) {
        if (
          t * 100 >= this.gradientPoints[j].pos &&
          t * 100 < this.gradientPoints[j + 1].pos
        ) {
          lower = this.gradientPoints[j];
          upper = this.gradientPoints[j + 1];
          break;
        }
      }

      // Calculate interpolation factor
      const range = upper.pos - lower.pos;
      const localT = (t * 100 - lower.pos) / range;

      // Interpolate RGB values
      gradient[i] = {
        r: this.lerp(lower.color.r, upper.color.r, localT),
        g: this.lerp(lower.color.g, upper.color.g, localT),
        b: this.lerp(lower.color.b, upper.color.b, localT),
      };
    }

    return gradient;
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  createGridGeometry() {
    const vertices = [];
    const margin = 0.9; // Scale down grid positions to reserve a margin around the grid
    // Center vertically
    const totalHeight = this.numY * this.stepY;
    const yStart = totalHeight / 2;

    for (let y = 0; y < this.numY; y++) {
      const rowCount = this.rowCounts[y];
      const rowWidth = rowCount * this.stepX;
      const xStart = -rowWidth / 2; // Center horizontally
      const yPos = yStart - y * this.stepY;

      for (let x = 0; x < rowCount; x++) {
        const xPos = xStart + x * this.stepX;

        // Convert to clip space coordinates (-1 to 1) and apply margin factor
        const x1 = (xPos / (this.gl.canvas.width / 2)) * margin;
        const x2 =
          ((xPos + this.rectWidth) / (this.gl.canvas.width / 2)) * margin;
        const y1 = (yPos / (this.gl.canvas.height / 2)) * margin;
        const y2 =
          ((yPos - this.rectHeight) / (this.gl.canvas.height / 2)) * margin;

        // Add two triangles for the rectangle
        vertices.push(
          x1,
          y1,
          x2,
          y1,
          x1,
          y2, // First triangle
          x2,
          y1,
          x2,
          y2,
          x1,
          y2 // Second triangle
        );
      }
    }

    this.gridVertices = new Float32Array(vertices);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.gridVertices,
      this.gl.STATIC_DRAW
    );

    console.log(
      "Grid geometry created:",
      this.gridVertices.length / 2,
      "vertices"
    );
  }

  updateDensityField(particleSystem) {
    if (!particleSystem || !particleSystem.getParticles) return;
    this.density = this.renderModes.getValues(particleSystem);
  }

  getCellIndex(col, row) {
    if (
      row < 0 ||
      row >= this.rowCounts.length ||
      col < 0 ||
      col >= this.rowCounts[row]
    ) {
      return -1;
    }

    let index = 0;
    for (let i = 0; i < row; i++) {
      index += this.rowCounts[i];
    }
    return index + col;
  }

  draw(particleSystem) {
    const program = this.shaderManager.use("grid");
    if (!program || !particleSystem) return;

    // Update density field based on particle positions
    this.updateDensityField(particleSystem);

    // Draw grid cells with density colors
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.enableVertexAttribArray(program.attributes.position);
    this.gl.vertexAttribPointer(
      program.attributes.position,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    let cellOffset = 0;
    for (let y = 0; y < this.numY; y++) {
      for (let x = 0; x < this.rowCounts[y]; x++) {
        const value = this.density[cellOffset];
        const normalizedValue = Math.max(
          0,
          Math.min(
            1,
            (value - this.minDensity) / (this.maxDensity - this.minDensity)
          )
        );

        const gradientIdx = Math.floor(normalizedValue * 255);
        const color = this.gradient[gradientIdx] || { r: 0, g: 0, b: 0 }; // Provide default color

        this.gl.uniform4fv(program.uniforms.color, [
          color.r,
          color.g,
          color.b,
          1.0,
        ]);
        this.gl.drawArrays(this.gl.TRIANGLES, cellOffset * 6, 6);
        cellOffset++;
      }
    }
  }

  // Add method to update gradient
  updateGradient() {
    this.gradient = this.createGradient();
  }
}

export { GridRenderer };
