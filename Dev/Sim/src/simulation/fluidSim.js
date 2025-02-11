import { FluidSolver } from "./fluidSolver.js";
import { GridRenderer } from "../renderer/gridRenderer.js";
import { ParticleRenderer } from "../renderer/particleRenderer.js";
import { ShaderManager } from "../shaders/shaderManager.js";
import { StateManager } from "../util/stateManager.js";

class FluidSim {
  constructor(gl, canvas, numX, numY) {
    if (!gl || typeof gl.createBuffer !== "function") {
      throw new Error("Valid WebGL context required");
    }

    this.gl = gl;
    this.canvas = canvas;
    this.width = Math.floor(Number(numX));
    this.height = Math.floor(Number(numY));

    if (this.width <= 0 || this.height <= 0) {
      throw new Error("Invalid dimensions");
    }

    // Physics parameters
    this.physics = {
      gravity: -9.81,
      timeStep: 1 / 60,
      damping: 0.98,
      bounds: {
        radius: 0.95, // Slightly smaller than render boundary
      },
    };

    // Initialize arrays
    this._particleCount = 100;
    this.particles = [];

    // Initialize mouse state
    this.mouse = {
      down: false,
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      forceMultiplier: 50,
      radius: 20,
      color: [1, 0, 0, 0.5],
      showDebug: true,
    };

    // Initialize handlers
    this.setupMouseHandlers();

    // Add state manager
    this.stateManager = new StateManager();

    // Extend FluidSolver initialization
    this.fluidSolver = new FluidSolver({
      width: this.width,
      height: this.height,
      timeStep: 1 / 60,
      viscosity: 0.1,
      diffusion: 0.01,
      pressure: 0.5,
    });
  }

  get particleCount() {
    return this._particleCount;
  }

  set particleCount(newCount) {
    this._particleCount = newCount;
    this.addInitialParticles();
  }

  async initialize() {
    try {
      // Initialize shader manager
      this.shaderManager = new ShaderManager(this.gl);
      await this.shaderManager.init();

      // Create renderers
      this.gridRenderer = new GridRenderer(this.gl, this.shaderManager);
      this.particleRenderer = new ParticleRenderer(this.gl, this.shaderManager);

      // Initialize fluid solver with config object
      this.fluidSolver = new FluidSolver({
        width: this.width,
        height: this.height,
        timeStep: 1 / 60,
      });

      // Add initial particles
      this.addInitialParticles();

      console.log("FluidSim initialized");
      return true;
    } catch (error) {
      console.error("FluidSim initialization failed:", error);
      throw error;
    }
  }

  addInitialParticles() {
    // (Re)create particles based on the current particleCount value.
    this.particles = [];
    // Create particles in a pattern or random distribution:
    const n = this._particleCount;
    for (let i = 0; i < n; i++) {
      // Example: place particles in a grid pattern.
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      this.particles.push({ x, y, vx: 0, vy: 0 });
    }
    console.log(`Created ${n} particles`);
  }

  setupMouseHandlers() {
    if (!this.canvas) {
      throw new Error("Canvas reference required for mouse handlers");
    }

    this.canvas.addEventListener("mousedown", (e) => {
      const pos = this.getMousePosition(e);
      this.mouse.down = true;
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;
      this.mouse.prevX = pos.x;
      this.mouse.prevY = pos.y;
      // console.log("🖱️ Mouse DOWN:", {
      //   normalized: pos,
      //   screen: { x: e.clientX, y: e.clientY },
      //   state: { ...this.mouse },
      // });
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (!this.mouse.down) return;

      const pos = this.getMousePosition(e);
      const dx = pos.x - this.mouse.prevX;
      const dy = pos.y - this.mouse.prevY;

      // console.log("🖱️ Mouse MOVE:", {
      //   pos,
      //   delta: { dx, dy },
      //   state: { ...this.mouse },
      // });

      // Apply force only if there's movement
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        this.applyMouseForce(pos.x, pos.y, dx, dy);
      }

      this.mouse.prevX = pos.x;
      this.mouse.prevY = pos.y;
    });

    this.canvas.addEventListener("mouseup", () => {
      this.mouse.down = false;
      // console.log("🖱️ Mouse UP:", { state: { ...this.mouse } });
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.mouse.down = false;
      // console.log("🖱️ Mouse LEAVE:", { state: { ...this.mouse } });
    });

    console.log("Mouse handlers initialized");
  }

  getMousePosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    // Convert to normalized coordinates (-1 to 1)
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2) + 1;

    // console.log("🖱️ Mouse position:", {
    //   screen: { x: e.clientX, y: e.clientY },
    //   canvas: { x, y },
    //   rect: { w: rect.width, h: rect.height },
    // });

    return { x, y };
  }

  start() {
    if (!this.gridRenderer || !this.particleRenderer) {
      console.error("Renderers not initialized - Call initialize() first");
      return false;
    }
    console.log("Animation starting with initialized renderers");
    this.animate();
    return true;
  }

  stop() {
    this.running = false;
    console.log("Simulation stopped");
  }

  animate() {
    this.stateManager.startFrame();

    // Update physics
    this.updateParticlePhysics();

    // Clear and setup frame
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Draw grid and boundary
    this.gridRenderer.draw();

    // Draw particles
    if (this.particles && this.particles.length > 0) {
      this.particleRenderer.draw(this.particles);
    }

    this.stateManager.endFrame();
    requestAnimationFrame(() => this.animate());
  }

  checkSimulationState(state) {
    if (
      !state.velocityBounds ||
      !state.pressureBounds ||
      !state.boundaryConditions
    ) {
      return false;
    }
    return true;
  }

  updateDebugInfo() {
    const debug = this.solver.getDebugInfo();
    console.log("Simulation Stats:", {
      maxVelocity: Math.max(debug.stats.maxVelocityU, debug.stats.maxVelocityV),
      maxPressure: debug.stats.maxPressure,
      solidCells: debug.stats.solidCells,
    });
  }

  // Debug control methods
  toggleDebug() {
    this.debugEnabled = !this.debugEnabled;
    console.log(`Debug mode ${this.debugEnabled ? "enabled" : "disabled"}`);
  }

  getSimulationState() {
    return {
      running: this.running,
      debug: this.debugEnabled,
      solver: this.solver.getDebugInfo(),
    };
  }

  updateParticlePhysics() {
    for (let particle of this.particles) {
      // Add velocity if not exists
      if (!particle.vx) particle.vx = 0;
      if (!particle.vy) particle.vy = 0;

      // Apply gravity
      particle.vy += this.physics.gravity * this.physics.timeStep;

      // Update position
      particle.x += particle.vx * this.physics.timeStep;
      particle.y += particle.vy * this.physics.timeStep;

      // Check boundary collision
      const distanceFromCenter = Math.sqrt(
        particle.x * particle.x + particle.y * particle.y
      );
      if (distanceFromCenter > this.physics.bounds.radius) {
        // Calculate normal vector
        const nx = particle.x / distanceFromCenter;
        const ny = particle.y / distanceFromCenter;

        // Place on boundary
        particle.x = nx * this.physics.bounds.radius;
        particle.y = ny * this.physics.bounds.radius;

        // Reflect velocity
        const dot = particle.vx * nx + particle.vy * ny;
        particle.vx = (particle.vx - 2 * dot * nx) * this.physics.damping;
        particle.vy = (particle.vy - 2 * dot * ny) * this.physics.damping;
      }
    }
  }

  applyMouseForce(x, y, dx, dy) {
    if (!this.mouse.down) return;

    const force = {
      x: dx * this.mouse.forceMultiplier,
      y: dy * this.mouse.forceMultiplier,
    };

    let affectedCount = 0;
    const radius = this.mouse.radius * 0.1; // Scale to normalized space

    for (let particle of this.particles) {
      const distX = particle.x - x;
      const distY = particle.y - y;
      const dist = Math.sqrt(distX * distX + distY * distY);

      if (dist < radius) {
        const factor = 1 - dist / radius;
        particle.vx += force.x * factor;
        particle.vy += force.y * factor;
        affectedCount++;
      }
    }

    // console.log("🖱️ Force Applied:", {
    //   force,
    //   affected: affectedCount,
    //   mouse: { x, y, radius },
    //   particles: this.particles.length,
    // });
  }
}

export { FluidSim };
