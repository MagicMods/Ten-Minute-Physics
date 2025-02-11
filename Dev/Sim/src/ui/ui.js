import GUI from "lil-gui";

class UI {
  constructor(simulation) {
    if (!simulation) {
      throw new Error("Simulation instance required");
    }
    this.sim = simulation;
    this.gui = new GUI();
    this.initGUI();
  }

  initGUI() {
    // Simulation controls
    const simFolder = this.gui.addFolder("Simulation");
    simFolder
      .add(this.sim, "particleCount", 0, 500, 10)
      .name("Particles")
      .onChange(() => {
        console.log(`Particle count updated: ${this.sim.particleCount}`);
      });

    // Physics controls
    const physicsFolder = this.gui.addFolder("Physics");
    physicsFolder.add(this.sim.physics, "gravity", -20, 0, 0.1).name("Gravity");
    physicsFolder.add(this.sim.physics, "damping", 0, 1, 0.01).name("Bounce");
    physicsFolder
      .add(this.sim.physics, "timeStep", 1 / 120, 1 / 30, 1 / 120)
      .name("Time Step");

    // Particle appearance
    const appearanceFolder = this.gui.addFolder("Appearance");
    appearanceFolder
      .add(this.sim.particleRenderer.config, "size", 1, 50)
      .name("Size");
    appearanceFolder
      .addColor(this.sim.particleRenderer.config, "color")
      .name("Color");

    // Fluid simulation controls
    const fluidFolder = this.gui.addFolder("Fluid");
    fluidFolder
      .add(this.sim.fluidSolver.config, "viscosity", 0, 1, 0.01)
      .name("Viscosity");
    fluidFolder
      .add(this.sim.fluidSolver.config, "diffusion", 0, 0.1, 0.001)
      .name("Diffusion");
    fluidFolder
      .add(this.sim.fluidSolver.config, "pressure", 0, 1, 0.1)
      .name("Pressure");

    // Mouse interaction controls
    const mouseFolder = this.gui.addFolder("Mouse");
    mouseFolder.add(this.sim.mouse, "forceMultiplier", 0, 100, 1).name("Force");
    mouseFolder.add(this.sim.mouse, "radius", 1, 50, 1).name("Radius");
    mouseFolder.addColor(this.sim.mouse, "color").name("Debug Color");
    mouseFolder.add(this.sim.mouse, "showDebug").name("Show Force");

    // Open folders by default
    simFolder.open();
    physicsFolder.open();
    appearanceFolder.open();
    fluidFolder.open();
    mouseFolder.open();

    console.log("UI initialized with physics controls");
  }

  dispose() {
    if (this.gui) {
      this.gui.destroy();
    }
  }
}

export { UI };
