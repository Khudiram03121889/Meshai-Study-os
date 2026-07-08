export type Weightage = "high" | "medium" | "low";
export type QuestionType = "conceptual" | "numerical" | "theory";
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export interface Topic {
  id: string;
  name: string;
  difficulty: DifficultyLevel;
  examWeightage: Weightage;
  questionType: QuestionType;
}

export interface Chapter {
  id: string;
  name: string;
  class: 11 | 12;
  topics: Topic[];
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  icon: string;
  chapters: Chapter[];
}

export interface Lecturer {
  id: string;
  name: string;
  subject: string;
  avatar: string;
}

/** Read the user's selected board from localStorage (set at registration). */
export function getUserBoard(userId: string | undefined): string {
  if (!userId) return "CBSE";
  return localStorage.getItem(`user_board_${userId}`) || "CBSE";
}

/** Friendly label for syllabus header, e.g. "NCERT Class 12 · CBSE" */
export function getUserBoardLabel(userId: string | undefined, classLevel: number = 12): string {
  const board = getUserBoard(userId);
  return `NCERT Class ${classLevel} · ${board}`;
}

const t = (id: string, name: string, difficulty: DifficultyLevel, examWeightage: Weightage, questionType: QuestionType): Topic => ({
  id, name, difficulty, examWeightage, questionType,
});

export const subjects: Subject[] = [
  {
    id: "physics",
    name: "Physics",
    color: "physics",
    icon: "⚡",
    chapters: [
      // --- CLASS 11 PHYSICS ---
      {
        id: "phy-11-ch1", name: "Units and Measurements", class: 11,
        topics: [
          t("phy-11-1-1", "SI Units", 1, "medium", "theory"),
          t("phy-11-1-2", "Significant Figures", 2, "medium", "numerical"),
          t("phy-11-1-3", "Dimensional Analysis", 3, "high", "numerical"),
          t("phy-11-1-4", "Errors in Measurement", 2, "medium", "numerical"),
        ],
      },
      {
        id: "phy-11-ch2", name: "Motion in a Straight Line", class: 11,
        topics: [
          t("phy-11-2-1", "Position, Displacement, Path Length", 1, "low", "theory"),
          t("phy-11-2-2", "Average Velocity and Speed", 2, "medium", "numerical"),
          t("phy-11-2-3", "Instantaneous Velocity and Speed", 3, "medium", "conceptual"),
          t("phy-11-2-4", "Kinematic Equations for Uniformly Accelerated Motion", 3, "high", "numerical"),
        ],
      },
      {
        id: "phy-11-ch3", name: "Motion in a Plane", class: 11,
        topics: [
          t("phy-11-3-1", "Scalars and Vectors", 2, "low", "theory"),
          t("phy-11-3-2", "Vector Addition & Resolution", 3, "high", "numerical"),
          t("phy-11-3-3", "Projectile Motion", 4, "high", "numerical"),
          t("phy-11-3-4", "Uniform Circular Motion", 3, "medium", "conceptual"),
        ],
      },
      {
        id: "phy-11-ch4", name: "Laws of Motion", class: 11,
        topics: [
          t("phy-11-4-1", "Newton's First & Second Laws", 2, "medium", "conceptual"),
          t("phy-11-4-2", "Newton's Third Law & Momentum Conservation", 3, "high", "numerical"),
          t("phy-11-4-3", "Friction (Static and Kinetic)", 3, "high", "numerical"),
          t("phy-11-4-4", "Dynamics of Circular Motion", 4, "high", "numerical"),
        ],
      },
      {
        id: "phy-11-ch5", name: "Work, Energy, and Power", class: 11,
        topics: [
          t("phy-11-5-1", "Work Done by Constant & Variable Forces", 2, "medium", "numerical"),
          t("phy-11-5-2", "Work-Energy Theorem", 3, "high", "numerical"),
          t("phy-11-5-3", "Potential Energy and Mechanical Energy Conservation", 3, "high", "numerical"),
          t("phy-11-5-4", "Power and Collisions (Elastic & Inelastic)", 4, "high", "numerical"),
        ],
      },
      {
        id: "phy-11-ch6", name: "System of Particles and Rotational Motion", class: 11,
        topics: [
          t("phy-11-6-1", "Centre of Mass", 3, "medium", "numerical"),
          t("phy-11-6-2", "Torque and Angular Momentum", 4, "high", "numerical"),
          t("phy-11-6-3", "Moment of Inertia", 4, "high", "numerical"),
          t("phy-11-6-4", "Theorems of Parallel and Perpendicular Axes", 3, "medium", "theory"),
        ],
      },
      {
        id: "phy-11-ch7", name: "Gravitation", class: 11,
        topics: [
          t("phy-11-7-1", "Kepler's Laws", 2, "medium", "theory"),
          t("phy-11-7-2", "Newton's Law of Gravitation", 2, "high", "numerical"),
          t("phy-11-7-3", "Acceleration due to Gravity (g)", 3, "high", "numerical"),
          t("phy-11-7-4", "Escape Velocity & Orbital Velocity", 3, "high", "numerical"),
        ],
      },
      {
        id: "phy-11-ch8", name: "Mechanical Properties of Solids", class: 11,
        topics: [
          t("phy-11-8-1", "Stress and Strain Relationship", 2, "medium", "conceptual"),
          t("phy-11-8-2", "Hooke's Law & Moduli of Elasticity", 3, "high", "numerical"),
          t("phy-11-8-3", "Elastic Potential Energy", 2, "low", "numerical"),
        ],
      },
      {
        id: "phy-11-ch9", name: "Mechanical Properties of Fluids", class: 11,
        topics: [
          t("phy-11-9-1", "Pressure & Pascal's Law", 2, "medium", "conceptual"),
          t("phy-11-9-2", "Bernoulli's Principle and Applications", 4, "high", "numerical"),
          t("phy-11-9-3", "Viscosity & Stoke's Law", 3, "medium", "numerical"),
          t("phy-11-9-4", "Surface Tension & Capillarity", 3, "high", "numerical"),
        ],
      },
      {
        id: "phy-11-ch10", name: "Thermal Properties of Matter", class: 11,
        topics: [
          t("phy-11-10-1", "Temperature & Thermal Expansion", 2, "medium", "numerical"),
          t("phy-11-10-2", "Specific Heat Capacity & Calorimetry", 3, "high", "numerical"),
          t("phy-11-10-3", "Latent Heat & Phase Change", 2, "medium", "conceptual"),
          t("phy-11-10-4", "Conduction, Convection & Radiation", 3, "high", "theory"),
        ],
      },
      {
        id: "phy-11-ch11", name: "Thermodynamics", class: 11,
        topics: [
          t("phy-11-11-1", "Zeroth & First Law of Thermodynamics", 2, "high", "conceptual"),
          t("phy-11-11-2", "Thermodynamic State Variables & Processes", 3, "high", "numerical"),
          t("phy-11-11-3", "Heat Engines and Refrigerators", 3, "medium", "numerical"),
          t("phy-11-11-4", "Second Law of Thermodynamics", 2, "low", "theory"),
        ],
      },
      {
        id: "phy-11-ch12", name: "Kinetic Theory", class: 11,
        topics: [
          t("phy-11-12-1", "Behaviour of Gases & Ideal Gas Equation", 2, "medium", "numerical"),
          t("phy-11-12-2", "Kinetic Theory Postulates & Pressure of Gas", 3, "medium", "conceptual"),
          t("phy-11-12-3", "Law of Equipartition of Energy", 3, "high", "theory"),
        ],
      },
      {
        id: "phy-11-ch13", name: "Oscillations", class: 11,
        topics: [
          t("phy-11-13-1", "Simple Harmonic Motion (SHM)", 3, "high", "conceptual"),
          t("phy-11-13-2", "Velocity and Acceleration in SHM", 3, "high", "numerical"),
          t("phy-11-13-3", "Energy in SHM (Kinetic and Potential)", 3, "high", "numerical"),
          t("phy-11-13-4", "Damped & Forced Oscillations, Resonance", 2, "low", "theory"),
        ],
      },
      {
        id: "phy-11-ch14", name: "Waves", class: 11,
        topics: [
          t("phy-11-14-1", "Transverse and Longitudinal Waves", 2, "medium", "conceptual"),
          t("phy-11-14-2", "Displacement and Wave Speed", 3, "high", "numerical"),
          t("phy-11-14-3", "Superposition & Standing Waves", 4, "high", "numerical"),
          t("phy-11-14-4", "Beats and Doppler Effect", 3, "medium", "conceptual"),
        ],
      },

      // --- CLASS 12 PHYSICS ---
      {
        id: "phy-ch1", name: "Electric Charges and Fields", class: 12,
        topics: [
          t("phy-1-1", "Coulomb's Law", 3, "high", "numerical"),
          t("phy-1-2", "Electric Field", 3, "high", "conceptual"),
          t("phy-1-3", "Electric Field Lines", 2, "medium", "conceptual"),
          t("phy-1-4", "Electric Dipole", 3, "high", "numerical"),
          t("phy-1-5", "Gauss's Theorem and Applications", 4, "high", "numerical"),
        ],
      },
      {
        id: "phy-ch2", name: "Electrostatic Potential and Capacitance", class: 12,
        topics: [
          t("phy-2-1", "Electric Potential", 3, "high", "numerical"),
          t("phy-2-2", "Potential Difference", 2, "high", "numerical"),
          t("phy-2-3", "Equipotential Surfaces", 2, "medium", "conceptual"),
          t("phy-2-4", "Capacitors", 3, "high", "numerical"),
          t("phy-2-5", "Capacitance", 3, "high", "numerical"),
          t("phy-2-6", "Dielectrics", 3, "medium", "conceptual"),
        ],
      },
      {
        id: "phy-ch3", name: "Current Electricity", class: 12,
        topics: [
          t("phy-3-1", "Ohm's Law", 2, "high", "numerical"),
          t("phy-3-2", "Electrical Resistivity", 2, "medium", "numerical"),
          t("phy-3-3", "Conductivity", 2, "medium", "conceptual"),
          t("phy-3-4", "Cells, EMF, Internal Resistance", 3, "high", "numerical"),
          t("phy-3-5", "Kirchhoff's Laws", 4, "high", "numerical"),
          t("phy-3-6", "Wheatstone Bridge", 3, "high", "numerical"),
        ],
      },
      {
        id: "phy-ch4", name: "Moving Charges and Magnetism", class: 12,
        topics: [
          t("phy-4-1", "Magnetic Force", 3, "high", "numerical"),
          t("phy-4-2", "Motion in Magnetic Field", 3, "high", "numerical"),
          t("phy-4-3", "Biot-Savart Law", 4, "high", "numerical"),
          t("phy-4-4", "Ampere's Circuital Law", 3, "high", "conceptual"),
          t("phy-4-5", "Solenoid", 3, "medium", "numerical"),
          t("phy-4-6", "Toroid", 3, "medium", "numerical"),
        ],
      },
      {
        id: "phy-ch5", name: "Magnetism and Matter", class: 12,
        topics: [
          t("phy-5-1", "Bar Magnet", 2, "medium", "conceptual"),
          t("phy-5-2", "Magnetic Field Lines", 2, "medium", "conceptual"),
          t("phy-5-3", "Earth's Magnetism", 2, "medium", "theory"),
          t("phy-5-4", "Diamagnetism", 2, "medium", "theory"),
          t("phy-5-5", "Paramagnetism", 2, "medium", "theory"),
          t("phy-5-6", "Ferromagnetism", 2, "medium", "theory"),
        ],
      },
      {
        id: "phy-ch6", name: "Electromagnetic Induction", class: 12,
        topics: [
          t("phy-6-1", "Magnetic Flux", 2, "high", "conceptual"),
          t("phy-6-2", "Faraday's Law of Induction", 3, "high", "numerical"),
          t("phy-6-3", "Lenz's Law", 3, "high", "conceptual"),
          t("phy-6-4", "Self and Mutual Inductance", 4, "high", "numerical"),
          t("phy-6-5", "AC Generator", 2, "medium", "conceptual"),
        ],
      },
      {
        id: "phy-ch7", name: "Alternating Current", class: 12,
        topics: [
          t("phy-7-1", "AC Voltage Applied to Resistor", 2, "medium", "numerical"),
          t("phy-7-2", "AC Voltage Applied to Inductor", 3, "medium", "numerical"),
          t("phy-7-3", "AC Voltage Applied to Capacitor", 3, "medium", "numerical"),
          t("phy-7-4", "LCR Circuit", 4, "high", "numerical"),
          t("phy-7-5", "Power in AC Circuit", 3, "high", "numerical"),
          t("phy-7-6", "Transformer", 3, "high", "conceptual"),
        ],
      },
      {
        id: "phy-ch8", name: "Electromagnetic Waves", class: 12,
        topics: [
          t("phy-8-1", "Displacement Current", 3, "medium", "conceptual"),
          t("phy-8-2", "Electromagnetic Waves Characteristics", 2, "medium", "conceptual"),
          t("phy-8-3", "EM Spectrum", 2, "high", "theory"),
          t("phy-8-4", "Applications of EM Waves", 2, "medium", "theory"),
        ],
      },
      {
        id: "phy-ch9", name: "Ray Optics and Optical Instruments", class: 12,
        topics: [
          t("phy-9-1", "Reflection", 2, "high", "numerical"),
          t("phy-9-2", "Refraction", 3, "high", "numerical"),
          t("phy-9-3", "Lenses", 3, "high", "numerical"),
          t("phy-9-4", "Prism", 3, "medium", "numerical"),
          t("phy-9-5", "Microscope", 3, "medium", "theory"),
          t("phy-9-6", "Telescope", 3, "medium", "theory"),
        ],
      },
      {
        id: "phy-ch10", name: "Wave Optics", class: 12,
        topics: [
          t("phy-10-1", "Huygens Principle", 3, "medium", "conceptual"),
          t("phy-10-2", "Interference", 3, "high", "numerical"),
          t("phy-10-3", "Young's Double Slit Experiment", 4, "high", "numerical"),
          t("phy-10-4", "Diffraction", 3, "medium", "conceptual"),
          t("phy-10-5", "Polarization", 2, "medium", "conceptual"),
        ],
      },
      {
        id: "phy-ch11", name: "Dual Nature of Radiation and Matter", class: 12,
        topics: [
          t("phy-11-1", "Electron Emission", 2, "medium", "theory"),
          t("phy-11-2", "Photoelectric Effect", 3, "high", "numerical"),
          t("phy-11-3", "Einstein's Photoelectric Equation", 3, "high", "numerical"),
          t("phy-11-4", "de Broglie Hypothesis", 3, "high", "numerical"),
        ],
      },
      {
        id: "phy-ch12", name: "Atoms", class: 12,
        topics: [
          t("phy-12-1", "Alpha-Particle Scattering", 2, "medium", "conceptual"),
          t("phy-12-2", "Rutherford's Model", 2, "medium", "conceptual"),
          t("phy-12-3", "Bohr Model", 3, "high", "numerical"),
          t("phy-12-4", "Hydrogen Spectrum", 3, "high", "numerical"),
          t("phy-12-5", "Energy Levels", 3, "high", "numerical"),
        ],
      },
      {
        id: "phy-ch13", name: "Nuclei", class: 12,
        topics: [
          t("phy-13-1", "Atomic Masses", 2, "medium", "numerical"),
          t("phy-13-2", "Nuclear Composition", 2, "medium", "conceptual"),
          t("phy-13-3", "Nuclear Size", 2, "medium", "conceptual"),
          t("phy-13-4", "Mass-Energy Relation", 3, "high", "numerical"),
          t("phy-13-5", "Nuclear Binding Energy", 3, "high", "numerical"),
          t("phy-13-6", "Radioactivity", 3, "high", "conceptual"),
          t("phy-13-7", "Nuclear Reactions", 3, "medium", "numerical"),
        ],
      },
      {
        id: "phy-ch14", name: "Semiconductor Electronics", class: 12,
        topics: [
          t("phy-14-1", "Semiconductors", 2, "medium", "conceptual"),
          t("phy-14-2", "p-n Junction", 3, "high", "conceptual"),
          t("phy-14-3", "Diode", 3, "high", "conceptual"),
          t("phy-14-4", "Transistor", 3, "high", "conceptual"),
          t("phy-14-5", "Logic Gates", 2, "high", "conceptual"),
        ],
      },
    ],
  },
  {
    id: "chemistry",
    name: "Chemistry",
    color: "chemistry",
    icon: "🧪",
    chapters: [
      // --- CLASS 11 CHEMISTRY ---
      {
        id: "chem-11-ch1", name: "Some Basic Concepts of Chemistry", class: 11,
        topics: [
          t("chem-11-1-1", "Laws of Chemical Combinations", 2, "medium", "conceptual"),
          t("chem-11-1-2", "Atomic and Molecular Masses", 2, "medium", "numerical"),
          t("chem-11-1-3", "Mole Concept and Molar Masses", 3, "high", "numerical"),
          t("chem-11-1-4", "Stoichiometry & Stoichiometric Calculations", 4, "high", "numerical"),
        ],
      },
      {
        id: "chem-11-ch2", name: "Structure of Atom", class: 11,
        topics: [
          t("chem-11-2-1", "Subatomic Particles & Thomson/Rutherford Models", 1, "low", "theory"),
          t("chem-11-2-2", "Bohr's Model for Hydrogen Atom", 3, "high", "numerical"),
          t("chem-11-2-3", "Quantum Mechanical Model (Quantum Numbers)", 3, "high", "conceptual"),
          t("chem-11-2-4", "Rules for Electron Configurations (Aufbau, Hund, Pauli)", 3, "high", "conceptual"),
        ],
      },
      {
        id: "chem-11-ch3", name: "Classification of Elements and Periodicity", class: 11,
        topics: [
          t("chem-11-3-1", "Modern Periodic Law & Table Structure", 2, "low", "theory"),
          t("chem-11-3-2", "Atomic and Ionic Radii Trends", 3, "high", "conceptual"),
          t("chem-11-3-3", "Ionization Enthalpy & Electron Gain Enthalpy", 3, "high", "conceptual"),
          t("chem-11-3-4", "Electronegativity & Chemical Valence", 2, "medium", "conceptual"),
        ],
      },
      {
        id: "chem-11-ch4", name: "Chemical Bonding and Molecular Structure", class: 11,
        topics: [
          t("chem-11-4-1", "Ionic Bond & Lattice Enthalpy", 2, "medium", "conceptual"),
          t("chem-11-4-2", "VSEPR Theory (Shape of Molecules)", 3, "high", "conceptual"),
          t("chem-11-4-3", "Hybridisation (sp, sp2, sp3, d-orbitals)", 4, "high", "conceptual"),
          t("chem-11-4-4", "Molecular Orbital Theory (MO Diagram & Bond Order)", 4, "high", "numerical"),
        ],
      },
      {
        id: "chem-11-ch5", name: "Thermodynamics", class: 11,
        topics: [
          t("chem-11-5-1", "State variables, Work, Heat", 3, "medium", "numerical"),
          t("chem-11-5-2", "First Law & Enthalpy Change (dH)", 3, "high", "numerical"),
          t("chem-11-5-3", "Hess's Law of Constant Heat Summation", 3, "high", "numerical"),
          t("chem-11-5-4", "Spontaneity, Entropy, and Gibbs Free Energy (dG)", 4, "high", "numerical"),
        ],
      },
      {
        id: "chem-11-ch6", name: "Equilibrium", class: 11,
        topics: [
          t("chem-11-6-1", "Law of Chemical Equilibrium & Le Chatelier's Principle", 3, "high", "conceptual"),
          t("chem-11-6-2", "Ionic Equilibrium (Acids, Bases, pH Scale)", 3, "high", "numerical"),
          t("chem-11-6-3", "Buffer Solutions & Salt Hydrolysis", 4, "high", "numerical"),
          t("chem-11-6-4", "Solubility Product Constant (Ksp)", 4, "high", "numerical"),
        ],
      },
      {
        id: "chem-11-ch7", name: "Redox Reactions", class: 11,
        topics: [
          t("chem-11-7-1", "Classical & Electronic Concepts", 2, "low", "theory"),
          t("chem-11-7-2", "Oxidation Number Assignment", 2, "high", "numerical"),
          t("chem-11-7-3", "Balancing Redox Reactions (Half-reaction/Oxidation State)", 3, "high", "numerical"),
        ],
      },
      {
        id: "chem-11-ch8", name: "Organic Chemistry - Basic Principles", class: 11,
        topics: [
          t("chem-11-8-1", "Classification and IUPAC Nomenclature", 3, "high", "theory"),
          t("chem-11-8-2", "Isomerism (Structural & Stereoisomerism)", 3, "high", "conceptual"),
          t("chem-11-8-3", "Electronic Effects (Inductive, Electromeric, Resonance)", 4, "high", "conceptual"),
          t("chem-11-8-4", "Purification Methods & Quantitative Analysis", 2, "medium", "numerical"),
        ],
      },
      {
        id: "chem-11-ch9", name: "Hydrocarbons", class: 11,
        topics: [
          t("chem-11-9-1", "Alkanes (Conformations of Ethane)", 2, "medium", "conceptual"),
          t("chem-11-9-2", "Alkenes (Preparation & Markownikoff's Rule)", 3, "high", "theory"),
          t("chem-11-9-3", "Alkynes (Acidic Character & Addition Reactions)", 3, "high", "theory"),
          t("chem-11-9-4", "Aromatic Hydrocarbons (Aromaticity & Electrophilic Substitution)", 4, "high", "conceptual"),
        ],
      },

      // --- CLASS 12 CHEMISTRY ---
      {
        id: "chem-ch1", name: "Solutions", class: 12,
        topics: [
          t("chem-1-1", "Types of Solutions", 2, "medium", "theory"),
          t("chem-1-2", "Expressing Concentration", 2, "high", "numerical"),
          t("chem-1-3", "Solubility", 2, "medium", "conceptual"),
          t("chem-1-4", "Vapour Pressure", 3, "high", "numerical"),
          t("chem-1-5", "Raoult's Law", 4, "high", "numerical"),
          t("chem-1-6", "Ideal and Non-ideal Solutions", 3, "medium", "conceptual"),
          t("chem-1-7", "Colligative Properties", 4, "high", "numerical"),
          t("chem-1-8", "Van't Hoff Factor", 3, "high", "numerical"),
        ],
      },
      {
        id: "chem-ch2", name: "Electrochemistry", class: 12,
        topics: [
          t("chem-2-1", "Electrochemical Cells", 3, "high", "conceptual"),
          t("chem-2-2", "Galvanic Cells", 3, "high", "conceptual"),
          t("chem-2-3", "Nernst Equation", 4, "high", "numerical"),
          t("chem-2-4", "EMF of Cell", 3, "high", "numerical"),
          t("chem-2-5", "Conductance of Electrolytic Solutions", 3, "high", "numerical"),
          t("chem-2-6", "Electrolysis", 3, "medium", "numerical"),
          t("chem-2-7", "Batteries", 2, "medium", "theory"),
          t("chem-2-8", "Fuel Cells", 2, "medium", "theory"),
        ],
      },
      {
        id: "chem-ch3", name: "Chemical Kinetics", class: 12,
        topics: [
          t("chem-3-1", "Rate of Reaction", 3, "high", "numerical"),
          t("chem-3-2", "Rate Law", 3, "high", "conceptual"),
          t("chem-3-3", "Order and Molecularity", 3, "high", "conceptual"),
          t("chem-3-4", "Integrated Rate Equations", 4, "high", "numerical"),
          t("chem-3-5", "Half-life", 3, "high", "numerical"),
          t("chem-3-6", "Collision Theory", 3, "medium", "conceptual"),
          t("chem-3-7", "Activation Energy", 3, "medium", "conceptual"),
          t("chem-3-8", "Arrhenius Equation", 3, "high", "numerical"),
        ],
      },
      {
        id: "chem-ch4", name: "The d- and f-Block Elements", class: 12,
        topics: [
          t("chem-4-1", "Position in Periodic Table", 2, "medium", "theory"),
          t("chem-4-2", "Electronic Configuration", 2, "high", "conceptual"),
          t("chem-4-3", "General Properties of Transition Elements", 3, "high", "theory"),
          t("chem-4-4", "Lanthanoid Contraction", 3, "medium", "conceptual"),
          t("chem-4-5", "Actinoids", 2, "low", "theory"),
          t("chem-4-6", "Applications", 2, "low", "theory"),
        ],
      },
      {
        id: "chem-ch5", name: "Coordination Compounds", class: 12,
        topics: [
          t("chem-5-1", "Werner's Theory", 3, "medium", "theory"),
          t("chem-5-2", "Ligands", 2, "high", "conceptual"),
          t("chem-5-3", "Coordination Number", 2, "high", "conceptual"),
          t("chem-5-4", "Nomenclature", 3, "high", "theory"),
          t("chem-5-5", "Isomerism", 3, "high", "conceptual"),
          t("chem-5-6", "Valence Bond Theory", 4, "high", "conceptual"),
          t("chem-5-7", "Crystal Field Theory", 4, "high", "conceptual"),
          t("chem-5-8", "Bonding in Metal Carbonyls", 3, "medium", "conceptual"),
        ],
      },
      {
        id: "chem-ch6", name: "Haloalkanes and Haloarenes", class: 12,
        topics: [
          t("chem-6-1", "Classification", 2, "medium", "theory"),
          t("chem-6-2", "Nomenclature", 2, "medium", "theory"),
          t("chem-6-3", "Nature of C-X Bond", 3, "medium", "conceptual"),
          t("chem-6-4", "Methods of Preparation", 3, "medium", "theory"),
          t("chem-6-5", "Physical Properties", 2, "low", "theory"),
          t("chem-6-6", "SN1 and SN2 Reactions", 4, "high", "conceptual"),
          t("chem-6-7", "Elimination Reactions", 3, "high", "conceptual"),
        ],
      },
      {
        id: "chem-ch7", name: "Alcohols, Phenols and Ethers", class: 12,
        topics: [
          t("chem-7-1", "Classification & Nomenclature", 2, "medium", "theory"),
          t("chem-7-2", "Structure", 2, "medium", "conceptual"),
          t("chem-7-3", "Preparation", 3, "medium", "theory"),
          t("chem-7-4", "Physical Properties", 2, "low", "theory"),
          t("chem-7-5", "Chemical Reactions", 3, "high", "conceptual"),
          t("chem-7-6", "Acidity of Alcohols and Phenols", 3, "high", "conceptual"),
          t("chem-7-7", "Reimer-Tiemann Reaction", 3, "high", "conceptual"),
          t("chem-7-8", "Williamson Synthesis", 3, "high", "conceptual"),
        ],
      },
      {
        id: "chem-ch8", name: "Aldehydes, Ketones and Carboxylic Acids", class: 12,
        topics: [
          t("chem-8-1", "Nomenclature", 2, "medium", "theory"),
          t("chem-8-2", "Nature of Carbonyl Group", 3, "high", "conceptual"),
          t("chem-8-3", "Preparation", 3, "medium", "theory"),
          t("chem-8-4", "Physical Properties", 2, "low", "theory"),
          t("chem-8-5", "Nucleophilic Addition", 4, "high", "conceptual"),
          t("chem-8-6", "Aldol Condensation", 4, "high", "conceptual"),
          t("chem-8-7", "Cannizzaro Reaction", 3, "high", "conceptual"),
        ],
      },
      {
        id: "chem-ch9", name: "Amines", class: 12,
        topics: [
          t("chem-9-1", "Classification & Nomenclature", 2, "medium", "theory"),
          t("chem-9-2", "Structure", 2, "medium", "conceptual"),
          t("chem-9-3", "Preparation", 3, "medium", "theory"),
          t("chem-9-4", "Physical Properties", 2, "low", "theory"),
          t("chem-9-5", "Chemical Reactions", 3, "high", "conceptual"),
          t("chem-9-6", "Basic Character of Amines", 3, "high", "conceptual"),
          t("chem-9-7", "Diazonium Salts", 3, "high", "conceptual"),
        ],
      },
      {
        id: "chem-ch10", name: "Biomolecules", class: 12,
        topics: [
          t("chem-10-1", "Carbohydrates: Monosaccharides", 2, "medium", "theory"),
          t("chem-10-2", "Disaccharides", 2, "medium", "theory"),
          t("chem-10-3", "Polysaccharides", 2, "medium", "theory"),
          t("chem-10-4", "Proteins: Amino Acids", 2, "medium", "theory"),
          t("chem-10-5", "Peptide Bond & Protein Structure", 3, "high", "conceptual"),
          t("chem-10-6", "Vitamins", 2, "medium", "theory"),
          t("chem-10-7", "Nucleic Acids: DNA & RNA", 3, "high", "conceptual"),
        ],
      },
    ],
  },
  {
    id: "mathematics",
    name: "Mathematics",
    color: "mathematics",
    icon: "📐",
    chapters: [
      // --- CLASS 11 MATHEMATICS ---
      {
        id: "math-11-ch1", name: "Sets", class: 11,
        topics: [
          t("math-11-1-1", "Representations and Empty Set", 1, "low", "theory"),
          t("math-11-1-2", "Subsets and Power Set", 2, "medium", "conceptual"),
          t("math-11-1-3", "Venn Diagrams & Operations", 2, "high", "numerical"),
          t("math-11-1-4", "Complement and Practical Problems", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch2", name: "Relations and Functions", class: 11,
        topics: [
          t("math-11-2-1", "Cartesian Product of Sets", 1, "low", "numerical"),
          t("math-11-2-2", "Domain and Range of Relations", 2, "high", "numerical"),
          t("math-11-2-3", "Real Functions & Domain/Range", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch3", name: "Trigonometric Functions", class: 11,
        topics: [
          t("math-11-3-1", "Radian and Degree Measure", 2, "low", "numerical"),
          t("math-11-3-2", "Signs of Trigonometric Functions", 2, "medium", "conceptual"),
          t("math-11-3-3", "Sum & Difference Formulae", 3, "high", "numerical"),
          t("math-11-3-4", "Trigonometric Equations (General Solutions)", 4, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch4", name: "Complex Numbers and Quadratic Equations", class: 11,
        topics: [
          t("math-11-4-1", "Algebra of Complex Numbers", 2, "medium", "numerical"),
          t("math-11-4-2", "Modulus & Conjugate of Complex Numbers", 3, "high", "numerical"),
          t("math-11-4-3", "Argand Plane & Polar Form", 3, "high", "numerical"),
          t("math-11-4-4", "Quadratic Equations in Complex System", 2, "medium", "numerical"),
        ],
      },
      {
        id: "math-11-ch5", name: "Linear Inequalities", class: 11,
        topics: [
          t("math-11-5-1", "Algebraic Solutions in One Variable", 2, "medium", "numerical"),
          t("math-11-5-2", "Graphical Solutions in Two Variables", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch6", name: "Permutations and Combinations", class: 11,
        topics: [
          t("math-11-6-1", "Fundamental Principle of Counting", 2, "medium", "conceptual"),
          t("math-11-6-2", "Permutations (nPr Formula & Word Problems)", 3, "high", "numerical"),
          t("math-11-6-3", "Combinations (nCr Formula & Selection Problems)", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch7", name: "Binomial Theorem", class: 11,
        topics: [
          t("math-11-7-1", "Binomial Expansion for Positive Integers", 3, "high", "numerical"),
          t("math-11-7-2", "General and Middle Terms", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch8", name: "Sequences and Series", class: 11,
        topics: [
          t("math-11-8-1", "Arithmetic Progression (AP) General Term & Sum", 2, "high", "numerical"),
          t("math-11-8-2", "Geometric Progression (GP) General Term & Sum", 3, "high", "numerical"),
          t("math-11-8-3", "Relationship between AM and GM", 3, "medium", "conceptual"),
        ],
      },
      {
        id: "math-11-ch9", name: "Straight Lines", class: 11,
        topics: [
          t("math-11-9-1", "Slope & Angle between Lines", 2, "medium", "numerical"),
          t("math-11-9-2", "Various Forms of Equations of a Line", 3, "high", "numerical"),
          t("math-11-9-3", "General Equation and Distance Formulas", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch10", name: "Conic Sections", class: 11,
        topics: [
          t("math-11-10-1", "Circle (Standard Equation)", 2, "high", "numerical"),
          t("math-11-10-2", "Parabola (Standard Equations & Focus/Latus)", 3, "high", "numerical"),
          t("math-11-10-3", "Ellipse (Standard Equations & Foci/Eccentricity)", 4, "high", "numerical"),
          t("math-11-10-4", "Hyperbola (Standard Equations & Foci/Asymptotes)", 4, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch11", name: "Introduction to Three Dimensional Geometry", class: 11,
        topics: [
          t("math-11-11-1", "Axes, Planes, and Coordinates", 1, "low", "theory"),
          t("math-11-11-2", "Distance between Two Points in 3D Space", 2, "medium", "numerical"),
          t("math-11-11-3", "Section Formula in 3D Space", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch12", name: "Limits and Derivatives", class: 11,
        topics: [
          t("math-11-12-1", "Intuitive Concept of Limits", 2, "medium", "conceptual"),
          t("math-11-12-2", "Limits of Algebraic & Trigonometric Functions", 3, "high", "numerical"),
          t("math-11-12-3", "Derivative of standard functions (First Principle)", 4, "high", "numerical"),
          t("math-11-12-4", "Algebra of Derivatives (Product & Quotient Rule)", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch13", name: "Statistics", class: 11,
        topics: [
          t("math-11-13-1", "Measures of Dispersion (Mean Deviation)", 2, "medium", "numerical"),
          t("math-11-13-2", "Variance and Standard Deviation", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-11-ch14", name: "Probability", class: 11,
        topics: [
          t("math-11-14-1", "Random Experiments & Sample Space", 1, "low", "theory"),
          t("math-11-14-2", "Events (Union, Intersection, Mutual Exclusion)", 2, "medium", "conceptual"),
          t("math-11-14-3", "Axiomatic Probability Calculations", 3, "high", "numerical"),
        ],
      },

      // --- CLASS 12 MATHEMATICS ---
      {
        id: "math-ch1", name: "Relations and Functions", class: 12,
        topics: [
          t("math-1-1", "Reflexive Relations", 2, "medium", "conceptual"),
          t("math-1-2", "Symmetric & Transitive Relations", 3, "medium", "conceptual"),
          t("math-1-3", "Equivalence Relations", 3, "high", "conceptual"),
          t("math-1-4", "One-to-One & Onto Functions", 3, "high", "conceptual"),
          t("math-1-5", "Composite Functions", 3, "high", "numerical"),
          t("math-1-6", "Inverse Functions", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-ch2", name: "Inverse Trigonometric Functions", class: 12,
        topics: [
          t("math-2-1", "Definition, Domain & Range", 3, "high", "conceptual"),
          t("math-2-2", "Principal Value Branch", 3, "high", "numerical"),
          t("math-2-3", "Graphs", 2, "medium", "conceptual"),
          t("math-2-4", "Properties & Elementary Properties", 4, "high", "numerical"),
        ],
      },
      {
        id: "math-ch3", name: "Matrices", class: 12,
        topics: [
          t("math-3-1", "Types of Matrices", 2, "medium", "theory"),
          t("math-3-2", "Equality of Matrices", 2, "medium", "conceptual"),
          t("math-3-3", "Addition & Scalar Multiplication", 2, "high", "numerical"),
          t("math-3-4", "Matrix Multiplication", 3, "high", "numerical"),
          t("math-3-5", "Transpose of a Matrix", 2, "medium", "numerical"),
          t("math-3-6", "Symmetric & Skew-Symmetric Matrices", 3, "high", "conceptual"),
          t("math-3-7", "Invertible Matrices", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-ch4", name: "Determinants", class: 12,
        topics: [
          t("math-4-1", "Determinant of Square Matrix (up to 3x3)", 3, "high", "numerical"),
          t("math-4-2", "Minors & Cofactors", 3, "high", "numerical"),
          t("math-4-3", "Properties of Determinants", 3, "high", "numerical"),
          t("math-4-4", "Area of Triangle using Determinants", 2, "medium", "numerical"),
          t("math-4-5", "Adjoint & Inverse of a Matrix", 4, "high", "numerical"),
          t("math-4-6", "Solution of Linear Equations", 4, "high", "numerical"),
        ],
      },
      {
        id: "math-ch5", name: "Continuity and Differentiability", class: 12,
        topics: [
          t("math-5-1", "Continuity", 3, "high", "conceptual"),
          t("math-5-2", "Differentiability", 4, "high", "numerical"),
          t("math-5-3", "Chain Rule", 3, "high", "numerical"),
          t("math-5-4", "Derivatives of Inverse Trigonometric Functions", 4, "high", "numerical"),
          t("math-5-5", "Implicit Functions", 3, "high", "numerical"),
          t("math-5-6", "Exponential & Logarithmic Functions", 3, "high", "numerical"),
          t("math-5-7", "Second Order Derivatives", 3, "medium", "numerical"),
        ],
      },
      {
        id: "math-ch6", name: "Application of Derivatives", class: 12,
        topics: [
          t("math-6-1", "Rate of Change", 3, "high", "numerical"),
          t("math-6-2", "Increasing/Decreasing Functions", 3, "high", "numerical"),
          t("math-6-3", "Tangents and Normals", 3, "high", "numerical"),
          t("math-6-4", "Approximations", 2, "medium", "numerical"),
          t("math-6-5", "Maxima and Minima", 4, "high", "numerical"),
          t("math-6-6", "First & Second Derivative Tests", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-ch7", name: "Integrals", class: 12,
        topics: [
          t("math-7-1", "Integration as Inverse of Differentiation", 2, "high", "numerical"),
          t("math-7-2", "Integration by Substitution", 3, "high", "numerical"),
          t("math-7-3", "Integration by Partial Fractions", 4, "high", "numerical"),
          t("math-7-4", "Integration by Parts", 4, "high", "numerical"),
          t("math-7-5", "Definite Integrals", 3, "high", "numerical"),
          t("math-7-6", "Fundamental Theorem of Calculus", 3, "high", "conceptual"),
        ],
      },
      {
        id: "math-ch8", name: "Application of Integrals", class: 12,
        topics: [
          t("math-8-1", "Area under Simple Curves", 3, "high", "numerical"),
          t("math-8-2", "Area between Two Curves", 4, "high", "numerical"),
          t("math-8-3", "Area of Regions bounded by Lines and Curves", 4, "high", "numerical"),
        ],
      },
      {
        id: "math-ch9", name: "Differential Equations", class: 12,
        topics: [
          t("math-9-1", "Order and Degree", 2, "high", "conceptual"),
          t("math-9-2", "Formation of Differential Equations", 3, "high", "numerical"),
          t("math-9-3", "General and Particular Solutions", 3, "medium", "numerical"),
          t("math-9-4", "Variable Separable Method", 3, "high", "numerical"),
          t("math-9-5", "Homogeneous Equations", 4, "high", "numerical"),
          t("math-9-6", "Linear Differential Equations", 4, "high", "numerical"),
        ],
      },
      {
        id: "math-ch10", name: "Vector Algebra", class: 12,
        topics: [
          t("math-10-1", "Vectors and Scalars", 2, "medium", "conceptual"),
          t("math-10-2", "Types of Vectors", 2, "medium", "conceptual"),
          t("math-10-3", "Addition & Scalar Multiplication", 2, "medium", "numerical"),
          t("math-10-4", "Scalar (Dot) Product", 3, "high", "numerical"),
          t("math-10-5", "Vector (Cross) Product", 3, "high", "numerical"),
          t("math-10-6", "Projection of a Vector", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-ch11", name: "Three Dimensional Geometry", class: 12,
        topics: [
          t("math-11-1", "Direction Cosines & Direction Ratios", 3, "high", "numerical"),
          t("math-11-2", "Cartesian & Vector Equation of a Line", 3, "high", "numerical"),
          t("math-11-3", "Angle between Two Lines", 3, "high", "numerical"),
          t("math-11-4", "Shortest Distance between Two Lines", 4, "high", "numerical"),
          t("math-11-5", "Equation of a Plane", 4, "high", "numerical"),
        ],
      },
      {
        id: "math-ch12", name: "Linear Programming", class: 12,
        topics: [
          t("math-12-1", "Constraints & Objective Function", 2, "high", "conceptual"),
          t("math-12-2", "Graphical Method", 3, "high", "numerical"),
          t("math-12-3", "Feasible and Infeasible Regions", 2, "medium", "conceptual"),
          t("math-12-4", "Optimal Solutions", 3, "high", "numerical"),
        ],
      },
      {
        id: "math-ch13", name: "Probability", class: 12,
        topics: [
          t("math-13-1", "Conditional Probability", 3, "high", "numerical"),
          t("math-13-2", "Multiplication Theorem", 3, "high", "numerical"),
          t("math-13-3", "Independent Events", 2, "medium", "numerical"),
          t("math-13-4", "Total Probability", 3, "high", "numerical"),
          t("math-13-5", "Bayes' Theorem", 4, "high", "numerical"),
          t("math-13-6", "Random Variable & Probability Distribution", 3, "high", "numerical"),
          t("math-13-7", "Mean of Random Variable", 3, "medium", "numerical"),
        ],
      },
    ],
  },
  {
    id: "botany",
    name: "Botany",
    color: "botany",
    icon: "🌱",
    chapters: [
      {
        id: "bot-11-ch1", name: "Plant Kingdom", class: 11,
        topics: [
          t("bot-11-1-1", "Algae & Bryophytes", 2, "medium", "theory"),
          t("bot-11-1-2", "Pteridophytes & Gymnosperms", 3, "medium", "theory"),
          t("bot-11-1-3", "Angiosperms & Plant Life Cycles", 2, "low", "theory"),
        ],
      },
      {
        id: "bot-11-ch2", name: "Morphology of Flowering Plants", class: 11,
        topics: [
          t("bot-11-2-1", "Root & Stem Modifications", 2, "high", "theory"),
          t("bot-11-2-2", "Leaf Venation & Phyllotaxy", 2, "medium", "theory"),
          t("bot-11-2-3", "Inflorescence & Flower Structure", 3, "high", "conceptual"),
          t("bot-11-2-4", "Fruit & Seed Classification", 3, "medium", "theory"),
        ],
      },
      {
        id: "bot-11-ch3", name: "Anatomy of Flowering Plants", class: 11,
        topics: [
          t("bot-11-3-1", "Meristematic & Permanent Tissues", 2, "medium", "theory"),
          t("bot-11-3-2", "Anatomy of Dicot & Monocot Root/Stem/Leaf", 4, "high", "conceptual"),
          t("bot-11-3-3", "Secondary Growth in Dicot Stem & Root", 4, "high", "conceptual"),
        ],
      },
      {
        id: "bot-11-ch4", name: "Cell: The Unit of Life", class: 11,
        topics: [
          t("bot-11-4-1", "Cell Theory & Prokayotic Cells", 1, "low", "theory"),
          t("bot-11-4-2", "Eukaryotic Cell Organelles & Functions", 3, "high", "conceptual"),
          t("bot-11-4-3", "Nucleus & Chromosome Structure", 3, "medium", "theory"),
        ],
      },
      {
        id: "bot-11-ch5", name: "Cell Cycle and Cell Division", class: 11,
        topics: [
          t("bot-11-5-1", "Stages of Cell Cycle (Interphase)", 2, "medium", "theory"),
          t("bot-11-5-2", "Mitosis (Karyokinesis and Cytokinesis)", 3, "high", "conceptual"),
          t("bot-11-5-3", "Meiosis I and Meiosis II (Significance)", 4, "high", "conceptual"),
        ],
      },
      {
        id: "bot-11-ch6", name: "Photosynthesis in Higher Plants", class: 11,
        topics: [
          t("bot-11-6-1", "Light Reaction & Photophosphorylation", 4, "high", "conceptual"),
          t("bot-11-6-2", "Dark Reaction (C3 and C4 Pathways)", 4, "high", "numerical"),
          t("bot-11-6-3", "Photorespiration & Factors Affecting Rate", 3, "medium", "conceptual"),
        ],
      },
      {
        id: "bot-11-ch7", name: "Respiration in Plants", class: 11,
        topics: [
          t("bot-11-7-1", "Glycolysis (EMP Pathway)", 3, "high", "conceptual"),
          t("bot-11-7-2", "TCA Cycle & Electron Transport System (ETS)", 5, "high", "conceptual"),
          t("bot-11-7-3", "Fermentation & Respiratory Quotient (RQ)", 3, "medium", "numerical"),
        ],
      },
      {
        id: "bot-11-ch8", name: "Plant Growth and Development", class: 11,
        topics: [
          t("bot-11-8-1", "Growth Phases & Differentiation", 2, "low", "theory"),
          t("bot-11-8-2", "Plant Growth Regulators (Auxin, Gibberellin, Cytokinin, Ethylene, ABA)", 4, "high", "conceptual"),
          t("bot-11-8-3", "Photoperiodism & Vernalisation", 3, "medium", "theory"),
        ],
      },
      {
        id: "bot-ch1", name: "Sexual Reproduction in Flowering Plants", class: 12,
        topics: [
          t("bot-1-1", "Microsporogenesis & Megasporogenesis", 3, "high", "conceptual"),
          t("bot-1-2", "Pollination Agencies & Outbreeding Devices", 2, "medium", "theory"),
          t("bot-1-3", "Double Fertilization & Triple Fusion", 3, "high", "conceptual"),
          t("bot-1-4", "Endosperm & Embryo Development", 3, "medium", "theory"),
          t("bot-1-5", "Apomixis & Polyembryony", 2, "low", "theory"),
        ],
      },
      {
        id: "bot-ch2", name: "Principles of Inheritance and Variation", class: 12,
        topics: [
          t("bot-2-1", "Mendelian Monohybrid & Dihybrid Crosses", 3, "high", "numerical"),
          t("bot-2-2", "Non-Mendelian Inheritance (Incomplete, Co-dominance)", 3, "high", "conceptual"),
          t("bot-2-3", "Chromosomal Theory of Inheritance & Linkage", 4, "high", "conceptual"),
          t("bot-2-4", "Genetic Disorders (Pedigree Analysis)", 4, "high", "numerical"),
        ],
      },
      {
        id: "bot-ch3", name: "Molecular Basis of Inheritance", class: 12,
        topics: [
          t("bot-3-1", "Structure of DNA & RNA", 2, "medium", "theory"),
          t("bot-3-2", "DNA Replication (Semi-conservative)", 3, "high", "conceptual"),
          t("bot-3-3", "Transcription & Genetic Code", 4, "high", "conceptual"),
          t("bot-3-4", "Translation (Protein Synthesis)", 4, "high", "conceptual"),
          t("bot-3-5", "Regulation of Gene Expression (Lac Operon)", 4, "high", "conceptual"),
          t("bot-3-6", "Human Genome Project & DNA Fingerprinting", 3, "medium", "theory"),
        ],
      },
      {
        id: "bot-ch4", name: "Biotechnology: Principles and Processes", class: 12,
        topics: [
          t("bot-4-1", "Restriction Enzymes & Ligases", 3, "high", "conceptual"),
          t("bot-4-2", "Cloning Vectors (Plasmids, Bacteriophages)", 4, "high", "conceptual"),
          t("bot-4-3", "Polymerase Chain Reaction (PCR)", 3, "high", "numerical"),
          t("bot-4-4", "Downstream Processing", 2, "low", "theory"),
        ],
      },
      {
        id: "bot-ch5", name: "Biotechnology and its Applications", class: 12,
        topics: [
          t("bot-5-1", "Bt Cotton & Pest Resistant Plants", 3, "high", "conceptual"),
          t("bot-5-2", "Genetically Engineered Insulin & Gene Therapy", 4, "high", "conceptual"),
          t("bot-5-3", "Transgenic Animals & Ethical Issues", 2, "low", "theory"),
        ],
      },
      {
        id: "bot-ch6", name: "Organisms and Populations", class: 12,
        topics: [
          t("bot-6-1", "Organism and its Environment (Abiotic Factors)", 2, "low", "theory"),
          t("bot-6-2", "Population Attributes & Growth Models (Exponential/Logistic)", 3, "high", "numerical"),
          t("bot-6-3", "Population Interactions (Mutualism, Competition, Predation)", 3, "high", "conceptual"),
        ],
      },
      {
        id: "bot-ch7", name: "Ecosystem", class: 12,
        topics: [
          t("bot-7-1", "Ecosystem Structure & Productivity", 2, "medium", "theory"),
          t("bot-7-2", "Decomposition & Energy Flow (Trophic Levels)", 3, "high", "conceptual"),
          t("bot-7-3", "Ecological Pyramids", 3, "medium", "conceptual"),
          t("bot-7-4", "Ecological Succession & Nutrient Cycles", 3, "medium", "theory"),
        ],
      },
      {
        id: "bot-ch8", name: "Biodiversity and Conservation", class: 12,
        topics: [
          t("bot-8-1", "Patterns & Loss of Biodiversity", 2, "high", "theory"),
          t("bot-8-2", "In-situ & Ex-situ Conservation", 2, "high", "theory"),
        ],
      },
    ],
  },
  {
    id: "zoology",
    name: "Zoology",
    color: "zoology",
    icon: "🐾",
    chapters: [
      {
        id: "zoo-11-ch1", name: "Animal Kingdom", class: 11,
        topics: [
          t("zoo-11-1-1", "Basis of Classification (Symmetry, Coelom)", 2, "high", "conceptual"),
          t("zoo-11-1-2", "Non-Chordates (Porifera to Echinodermata)", 3, "high", "theory"),
          t("zoo-11-1-3", "Chordates (Pisces, Amphibia, Reptilia, Aves, Mammalia)", 3, "high", "theory"),
        ],
      },
      {
        id: "zoo-11-ch2", name: "Structural Organisation in Animals", class: 11,
        topics: [
          t("zoo-11-2-1", "Animal Tissues (Epithelial, Connective, Muscular, Neural)", 2, "high", "theory"),
          t("zoo-11-2-2", "Morphology and Anatomy of Cockroach/Frog", 4, "medium", "conceptual"),
        ],
      },
      {
        id: "zoo-11-ch3", name: "Biomolecules", class: 11,
        topics: [
          t("zoo-11-3-1", "Amino Acids, Proteins, Carbohydrates, Lipids", 3, "high", "conceptual"),
          t("zoo-11-3-2", "Structure of Proteins (Primary, Secondary, Tertiary)", 3, "medium", "conceptual"),
          t("zoo-11-3-3", "Enzymes (Mechanism of Action, Inhibition, Factors)", 4, "high", "numerical"),
        ],
      },
      {
        id: "zoo-11-ch4", name: "Breathing and Exchange of Gases", class: 11,
        topics: [
          t("zoo-11-4-1", "Respiratory Organs & Mechanism of Breathing", 2, "medium", "theory"),
          t("zoo-11-4-2", "Exchange & Transport of Gases (O2 & CO2 Curve)", 4, "high", "conceptual"),
          t("zoo-11-4-3", "Regulation of Respiration & Disorders", 2, "medium", "theory"),
        ],
      },
      {
        id: "zoo-11-ch5", name: "Body Fluids and Circulation", class: 11,
        topics: [
          t("zoo-11-5-1", "Blood Composition & Coagulation", 2, "medium", "theory"),
          t("zoo-11-5-2", "Human Circulatory System & Cardiac Cycle", 4, "high", "conceptual"),
          t("zoo-11-5-3", "Electrocardiogram (ECG) & Double Circulation", 3, "high", "conceptual"),
          t("zoo-11-5-4", "Regulation & Disorders of Circulatory System", 2, "medium", "theory"),
        ],
      },
      {
        id: "zoo-11-ch6", name: "Excretory Products and their Elimination", class: 11,
        topics: [
          t("zoo-11-6-1", "Human Excretory System & Nephron Structure", 2, "medium", "theory"),
          t("zoo-11-6-2", "Urine Formation (Ultrafiltration, Reabsorption)", 3, "high", "conceptual"),
          t("zoo-11-6-3", "Counter Current Mechanism & Osmoregulation", 4, "high", "conceptual"),
          t("zoo-11-6-4", "Disorders & Dialysis", 2, "low", "theory"),
        ],
      },
      {
        id: "zoo-11-ch7", name: "Locomotion and Movement", class: 11,
        topics: [
          t("zoo-11-7-1", "Types of Movement & Muscle Structure", 2, "medium", "theory"),
          t("zoo-11-7-2", "Mechanism of Muscle Contraction (Sliding Filament)", 4, "high", "conceptual"),
          t("zoo-11-7-3", "Skeletal System & Joints", 3, "medium", "theory"),
          t("zoo-11-7-4", "Disorders of Muscular & Skeletal Systems", 2, "low", "theory"),
        ],
      },
      {
        id: "zoo-11-ch8", name: "Neural Control and Coordination", class: 11,
        topics: [
          t("zoo-11-8-1", "Neurons & Nerve Impulse Generation/Conduction", 4, "high", "conceptual"),
          t("zoo-11-8-2", "Central Nervous System (Brain Parts)", 3, "high", "theory"),
          t("zoo-11-8-3", "Reflex Action & Reflex Arc", 2, "medium", "conceptual"),
        ],
      },
      {
        id: "zoo-11-ch9", name: "Chemical Coordination and Integration", class: 11,
        topics: [
          t("zoo-11-9-1", "Endocrine Glands and Hormones", 2, "high", "theory"),
          t("zoo-11-9-2", "Mechanism of Hormone Action", 4, "high", "conceptual"),
          t("zoo-11-9-3", "Hormonal Disorders", 3, "high", "theory"),
        ],
      },
      {
        id: "zoo-ch1", name: "Human Reproduction", class: 12,
        topics: [
          t("zoo-1-1", "Male & Female Reproductive Systems", 2, "medium", "theory"),
          t("zoo-1-2", "Gametogenesis (Spermatogenesis & Oogenesis)", 3, "high", "conceptual"),
          t("zoo-1-3", "Menstrual Cycle & Hormonal Regulation", 4, "high", "conceptual"),
          t("zoo-1-4", "Fertilization, Pregnancy & Embryonic Development", 3, "high", "conceptual"),
          t("zoo-1-5", "Parturition & Lactation", 2, "low", "theory"),
        ],
      },
      {
        id: "zoo-ch2", name: "Reproductive Health", class: 12,
        topics: [
          t("zoo-2-1", "Population Explosion & Contraceptive Methods", 2, "high", "theory"),
          t("zoo-2-2", "Medical Termination of Pregnancy (MTP) & STDs", 2, "medium", "theory"),
          t("zoo-2-3", "Infertility & Assisted Reproductive Technologies (ART)", 3, "high", "conceptual"),
        ],
      },
      {
        id: "zoo-ch3", name: "Evolution", class: 12,
        topics: [
          t("zoo-3-1", "Origin of Life & Evidences for Evolution", 2, "medium", "theory"),
          t("zoo-3-2", "Adaptive Radiation & Darwinian Evolution", 3, "high", "conceptual"),
          t("zoo-3-3", "Hardy-Weinberg Principle", 4, "high", "numerical"),
          t("zoo-3-4", "Origin and Evolution of Man", 3, "medium", "theory"),
        ],
      },
      {
        id: "zoo-ch4", name: "Human Health and Disease", class: 12,
        topics: [
          t("zoo-4-1", "Common Infectious Diseases in Humans", 2, "high", "theory"),
          t("zoo-4-2", "Immunity (Innate, Acquired, Active, Passive)", 3, "high", "conceptual"),
          t("zoo-4-3", "AIDS, Cancer, and Drug/Alcohol Abuse", 3, "high", "theory"),
        ],
      },
      {
        id: "zoo-ch5", name: "Microbes in Human Welfare", class: 12,
        topics: [
          t("zoo-5-1", "Microbes in Household & Industrial Products", 2, "medium", "theory"),
          t("zoo-5-2", "Microbes in Sewage Treatment & Biogas Production", 3, "high", "conceptual"),
          t("zoo-5-3", "Microbes as Biocontrol Agents & Biofertilisers", 2, "low", "theory"),
        ],
      },
    ],
  },
];

export function getBoardSpecificSubjects(baseSubjects: Subject[], board: string): Subject[] {
  // Deep clone to avoid mutating the original
  const subjectsClone: Subject[] = JSON.parse(JSON.stringify(baseSubjects));

  if (board === "Maharashtra State Board (HSC)") {
    return subjectsClone.map((sub) => {
      if (sub.id === "physics") {
        const mappedChapters = sub.chapters.map((ch) => {
          const class12ChapterIds = ["phy-11-ch6", "phy-11-ch9", "phy-11-ch11", "phy-11-ch12", "phy-11-ch13", "phy-11-ch14"];
          if (class12ChapterIds.includes(ch.id)) {
            ch.class = 12;
            if (ch.id === "phy-11-ch6") ch.name = "Rotational Dynamics";
            if (ch.id === "phy-11-ch12") ch.name = "Kinetic Theory of Gases and Radiation";
            if (ch.id === "phy-11-ch14") ch.name = "Superposition of Waves";
          }
          if (ch.id === "phy-ch1") { ch.name = "Electrostatics"; ch.class = 12; }
          if (ch.id === "phy-ch2") { ch.name = "Electrostatics (Part 2)"; ch.class = 12; }
          if (ch.id === "phy-ch4") ch.name = "Magnetic Fields due to Electric Current";
          if (ch.id === "phy-ch5") ch.name = "Magnetic Materials";
          if (ch.id === "phy-ch7") ch.name = "AC Circuits";
          if (ch.id === "phy-ch12") ch.name = "Structure of Atoms and Nuclei";
          if (ch.id === "phy-ch13") ch.name = "Structure of Atoms and Nuclei (Part 2)";
          if (ch.id === "phy-ch14") ch.name = "Semiconductor Devices";
          return ch;
        });
        return { ...sub, chapters: mappedChapters };
      }

      if (sub.id === "chemistry") {
        const mappedChapters = sub.chapters.map((ch) => {
          const class12ChemIds = ["chem-11-ch5", "chem-11-ch6"];
          if (class12ChemIds.includes(ch.id)) {
            ch.class = 12;
            if (ch.id === "chem-11-ch5") ch.name = "Chemical Thermodynamics";
            if (ch.id === "chem-11-ch6") ch.name = "Ionic Equilibria";
          }
          if (ch.id === "chem-ch4") ch.name = "Transition and Inner Transition Elements";
          if (ch.id === "chem-ch6") ch.name = "Halogen Derivatives";
          return ch;
        });
        return { ...sub, chapters: mappedChapters };
      }

      if (sub.id === "mathematics") {
        const mappedChapters = sub.chapters.map((ch) => {
          if (ch.id === "math-ch1") ch.name = "Mathematical Logic";
          if (ch.id === "math-ch7") ch.name = "Indefinite Integration";
          if (ch.id === "math-ch8") ch.name = "Application of Definite Integration";
          if (ch.id === "math-ch12") ch.name = "Linear Programming (LPP)";
          return ch;
        });
        return { ...sub, chapters: mappedChapters };
      }

      return sub;
    });
  }

  if (board === "Tamil Nadu State Board") {
    return subjectsClone.map((sub) => {
      if (sub.id === "physics") {
        const mappedChapters = sub.chapters.map((ch) => {
          if (ch.id === "phy-ch3") ch.name = "Magnetism and Magnetic Effects of Electric Current";
          if (ch.id === "phy-ch4") ch.name = "Electromagnetic Induction and Alternating Current";
          if (ch.id === "phy-ch6") ch.name = "Electromagnetic Induction and Alternating Current (Part 2)";
          if (ch.id === "phy-ch12") ch.name = "Atomic and Nuclear Physics";
          if (ch.id === "phy-ch13") ch.name = "Atomic and Nuclear Physics (Part 2)";
          if (ch.id === "phy-ch14") ch.name = "Electronics and Communication";
          return ch;
        });
        return { ...sub, chapters: mappedChapters };
      }
      return sub;
    });
  }

  if (board === "Karnataka State Board (PUC)") {
    return subjectsClone.map((sub) => {
      if (sub.id === "physics") {
        if (!sub.chapters.some((ch) => ch.id === "phy-ch15")) {
          const newChapters = [...sub.chapters];
          newChapters.push({
            id: "phy-ch15",
            name: "Communication Systems",
            class: 12,
            topics: [
              t("phy-15-1", "Elements of Communication System", 2, "medium", "theory"),
              t("phy-15-2", "Bandwidth", 2, "medium", "theory"),
              t("phy-15-3", "Modulation", 2, "medium", "conceptual"),
              t("phy-15-4", "Amplitude Modulation", 2, "medium", "numerical"),
              t("phy-15-5", "Demodulation", 2, "low", "theory"),
            ]
          });
          return { ...sub, chapters: newChapters };
        }
      }
      return sub;
    });
  }

  return subjectsClone;
}

import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useSubjects() {
  const { user } = useAuth();
  const board = getUserBoard(user?.id);

  return useMemo(() => {
    const boardSpecific = getBoardSpecificSubjects(subjects, board);

    if (!user) return boardSpecific.filter((s) => ["physics", "chemistry", "mathematics"].includes(s.id));
    
    const saved = localStorage.getItem(`user_subjects_${user.id}`);
    if (saved) {
      try {
        const slugs = JSON.parse(saved);
        return boardSpecific.filter((s) => slugs.includes(s.id));
      } catch {
        // ignore
      }
    }
    // Default fallback
    return boardSpecific.filter((s) => ["physics", "chemistry", "mathematics"].includes(s.id));
  }, [user?.id, board]);
}
