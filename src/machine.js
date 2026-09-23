const STATES = {
  IDLE: "IDLE",
  STARTING: "STARTING",
  OPERATING: "OPERATING",
  LOADING: "LOADING",
  TRANSPORTING: "TRANSPORTING",
  UNLOADING: "UNLOADING",
};

const STATE_DURATIONS = {
  IDLE: 4,
  STARTING: 2,
  OPERATING: 4,
  LOADING: 4,
  TRANSPORTING: 5,
  UNLOADING: 3,
};

const STATE_TRANSITIONS = {
  IDLE: "STARTING",
  STARTING: "OPERATING",
  OPERATING: "LOADING",
  LOADING: "TRANSPORTING",
  TRANSPORTING: "UNLOADING",
  UNLOADING: "IDLE",
};


/*
 * -----------------------------------------
 * BASE FUEL CONSUMPTION RATES
 * -----------------------------------------
 *
 * Unit: litres per hour (L/h)
 *
 * These are the expected fuel consumption
 * rates for each machine operating state.
 */

const FUEL_CONSUMPTION_RATES = {
  IDLE: 4,
  STARTING: 8,
  OPERATING: 14,
  LOADING: 22,
  TRANSPORTING: 18,
  UNLOADING: 16,
};


function createMachine({
  machineId,
  scenario,
  latitude,
  longitude,
}) {
  return {
    /*
     * -------------------------------------
     * MACHINE IDENTITY
     * -------------------------------------
     */

    machineId,
    scenario,


    /*
     * -------------------------------------
     * MACHINE STATE
     * -------------------------------------
     */

    state: STATES.IDLE,

    stateTicks: 0,


    /*
     * -------------------------------------
     * ENGINE HOURS
     * -------------------------------------
     *
     * Initial simulated lifetime of the
     * machine.
     */

    engineHours: Number(
      (1000 + Math.random() * 600).toFixed(2)
    ),


    /*
     * -------------------------------------
     * FUEL
     * -------------------------------------
     *
     * fuelLevelLitres:
     * Current amount of fuel remaining.
     *
     * fuelConsumedLitres:
     * Cumulative fuel consumed.
     *
     * fuelConsumptionRateLph:
     * Current consumption rate.
     *
     * fuelConsumptionMultiplier:
     * Scenario-specific multiplier.
     *
     * Normal = 1
     * Abnormal fuel consumption = 1.6
     */

    fuelLevelLitres: 320,

    fuelConsumedLitres: 1280,

    fuelConsumptionRateLph: 0,

    fuelConsumptionMultiplier: 1,


    /*
     * -------------------------------------
     * WORKLOAD
     * -------------------------------------
     */

    loadCycles: Math.floor(
      5 + Math.random() * 10
    ),

    idleTime: 0,


    /*
     * -------------------------------------
     * ENGINE / MACHINE HEALTH
     * -------------------------------------
     */

    engineRpm: 300,

    engineTemperature: 70,

    hydraulicTemperature: 65,

    vibration: 0.15,


    /*
     * -------------------------------------
     * SAFETY
     * -------------------------------------
     */

    seatbeltStatus: true,

    operatorId: null,

    operatorPresent: true,

    hydraulicLockout: true,

    parkingBrake: true,

    nearestObjectDistanceM: 22,

    impactG: 0.1,

    hornUntil: 0,


    /*
     * -------------------------------------
     * MOTION / LOAD
     * -------------------------------------
     */

    speedKph: 0,

    tiltAngleDeg: 1.5,

    swingAngleDeg: 0,

    boomHeightM: 1,

    loadWeightKg: 0,

    ratedCapacityKg: 5000,

    oilPressureKpa: 180,

    terrain: "FLAT",

    sensorFaults: {},


    /*
     * -------------------------------------
     * LOCATION
     * -------------------------------------
     */

    location: {
      latitude,
      longitude,
    },
  };
}


/*
 * -----------------------------------------
 * SMOOTH VALUE TRANSITION
 * -----------------------------------------
 *
 * Moves a value toward a target without
 * making unrealistic jumps.
 */

function approach(current, target, step) {
  if (current < target) {
    return Math.min(
      current + step,
      target
    );
  }

  if (current > target) {
    return Math.max(
      current - step,
      target
    );
  }

  return current;
}


/*
 * -----------------------------------------
 * MACHINE STATE TRANSITION
 * -----------------------------------------
 */

function updateMachineState(machine) {
  machine.stateTicks++;

  const duration =
    STATE_DURATIONS[machine.state];

  if (machine.stateTicks >= duration) {
    machine.state =
      STATE_TRANSITIONS[machine.state];

    machine.stateTicks = 0;

    console.log(
      `[STATE] ${machine.machineId} → ${machine.state}`
    );
  }
}


/*
 * -----------------------------------------
 * UPDATE MACHINE TELEMETRY
 * -----------------------------------------
 *
 * intervalMs is important here because
 * physical quantities such as fuel consumed
 * and engine hours depend on elapsed time.
 *
 * Example:
 *
 * 4000 ms = 4 seconds
 *
 * 4 seconds / 3600
 * = 0.001111 hours
 */

function updateTelemetry(
  machine,
  intervalMs
) {
  const state = machine.state;


  /*
   * ---------------------------------------
   * TIME CONVERSION
   * ---------------------------------------
   */

  const simulationIntervalSeconds =
    intervalMs / 1000;

  const hoursPerTick =
    simulationIntervalSeconds / 3600;


  /*
   * ---------------------------------------
   * ENGINE RPM
   * ---------------------------------------
   */

  const rpmTargets = {
    IDLE: 300,
    STARTING: 900,
    OPERATING: 1500,
    LOADING: 1850,
    TRANSPORTING: 1600,
    UNLOADING: 1300,
  };

  machine.engineRpm = approach(
    machine.engineRpm,
    rpmTargets[state],
    150
  );


  /*
   * ---------------------------------------
   * ENGINE TEMPERATURE
   * ---------------------------------------
   */

  const engineTemperatureTargets = {
    IDLE: 70,
    STARTING: 74,
    OPERATING: 80,
    LOADING: 88,
    TRANSPORTING: 84,
    UNLOADING: 82,
  };

  machine.engineTemperature =
    approach(
      machine.engineTemperature,
      engineTemperatureTargets[state],
      2
    );


  /*
   * ---------------------------------------
   * HYDRAULIC TEMPERATURE
   * ---------------------------------------
   */

  const hydraulicTemperatureTargets = {
    IDLE: 65,
    STARTING: 68,
    OPERATING: 72,
    LOADING: 90,
    TRANSPORTING: 82,
    UNLOADING: 85,
  };

  machine.hydraulicTemperature =
    approach(
      machine.hydraulicTemperature,
      hydraulicTemperatureTargets[state],
      2
    );


  /*
   * ---------------------------------------
   * VIBRATION
   * ---------------------------------------
   */

  const vibrationTargets = {
    IDLE: 0.15,
    STARTING: 0.25,
    OPERATING: 0.35,
    LOADING: 0.65,
    TRANSPORTING: 0.55,
    UNLOADING: 0.45,
  };

  machine.vibration = approach(
    machine.vibration,
    vibrationTargets[state],
    0.08
  );


  /*
   * ---------------------------------------
   * FUEL CONSUMPTION RATE
   * ---------------------------------------
   *
   * First determine the normal expected
   * consumption for the current state.
   */

  const baseFuelConsumptionRate =
    FUEL_CONSUMPTION_RATES[state];


  /*
   * Apply scenario-specific multiplier.
   *
   * Normal:
   *
   * 22 L/h × 1
   * = 22 L/h
   *
   * Abnormal:
   *
   * 22 L/h × 1.6
   * = 35.2 L/h
   */

  const fuelConsumptionMultiplier =
    machine.fuelConsumptionMultiplier || 1;

  machine.fuelConsumptionRateLph =
    baseFuelConsumptionRate *
    fuelConsumptionMultiplier;


  /*
   * ---------------------------------------
   * FUEL CONSUMED DURING THIS TICK
   * ---------------------------------------
   *
   * Formula:
   *
   * fuel consumed =
   * consumption rate × elapsed hours
   *
   * Example:
   *
   * 22 L/h × (4 / 3600)
   * ≈ 0.0244 litres
   */

  const fuelConsumedThisTick =
    machine.fuelConsumptionRateLph *
    hoursPerTick;


  /*
   * ---------------------------------------
   * CUMULATIVE FUEL CONSUMPTION
   * ---------------------------------------
   */

  machine.fuelConsumedLitres +=
    fuelConsumedThisTick;


  /*
   * ---------------------------------------
   * CURRENT FUEL LEVEL
   * ---------------------------------------
   *
   * Never allow the tank to go below zero.
   */

  machine.fuelLevelLitres =
    Math.max(
      0,
      machine.fuelLevelLitres -
        fuelConsumedThisTick
    );


  /*
   * ---------------------------------------
   * ENGINE HOURS
   * ---------------------------------------
   *
   * Engine hours advance according to
   * actual elapsed simulation time.
   */

  machine.engineHours +=
    hoursPerTick;


  /*
   * ---------------------------------------
   * IDLE TIME
   * ---------------------------------------
   */

  if (state === STATES.IDLE) {
    /*
     * Convert elapsed seconds into minutes.
     */

    machine.idleTime +=
      simulationIntervalSeconds / 60;
  }


  /*
   * ---------------------------------------
   * LOAD CYCLES
   * ---------------------------------------
   *
   * A new load cycle begins when the
   * machine enters LOADING.
   */

  if (
    state === STATES.LOADING &&
    machine.stateTicks === 1
  ) {
    machine.loadCycles += 1;
  }


  /*
   * ---------------------------------------
   * MACHINE MOVEMENT
   * ---------------------------------------
   *
   * Movement occurs during active work
   * and transportation.
   */

  if (
    state === STATES.TRANSPORTING ||
    state === STATES.LOADING
  ) {
    machine.location.latitude +=
      (Math.random() - 0.5) * 0.0001;

    machine.location.longitude +=
      (Math.random() - 0.5) * 0.0001;
  }
}


/*
 * -----------------------------------------
 * EXTENDED TELEMETRY
 * -----------------------------------------
 *
 * Safety-related fields used by the operator
 * dashboard (pre-check, safety engine). Only
 * the live simulator calls this; the ML
 * dataset generator does not.
 */

const BOOM_HEIGHT_TARGETS = {
  IDLE: 1.0,
  STARTING: 1.0,
  OPERATING: 2.0,
  LOADING: 1.2,
  TRANSPORTING: 3.5,
  UNLOADING: 4.0,
};

const SWING_TARGETS = {
  IDLE: 0,
  STARTING: 0,
  OPERATING: 0,
  LOADING: 0,
  TRANSPORTING: 90,
  UNLOADING: 120,
};

function jitter(amount) {
  return (Math.random() - 0.5) * 2 * amount;
}

function updateExtendedTelemetry(machine) {
  const state = machine.state;
  const idle = state === STATES.IDLE;

  machine.operatorPresent = true;
  machine.hydraulicLockout = idle;
  machine.parkingBrake = idle || state === STATES.STARTING;
  machine.terrain = "FLAT";

  machine.speedKph = approach(
    machine.speedKph,
    state === STATES.TRANSPORTING ? 4.5 : 0,
    1.5
  );

  machine.tiltAngleDeg = approach(
    machine.tiltAngleDeg,
    1.5 + jitter(0.8),
    0.5
  );

  machine.swingAngleDeg = approach(
    machine.swingAngleDeg,
    SWING_TARGETS[state],
    30
  );

  machine.boomHeightM = approach(
    machine.boomHeightM,
    BOOM_HEIGHT_TARGETS[state],
    0.6
  );

  if (state === STATES.LOADING) {
    machine.loadWeightKg = approach(machine.loadWeightKg, 3800, 1200);
  } else if (state === STATES.UNLOADING || idle) {
    machine.loadWeightKg = approach(machine.loadWeightKg, 0, 1500);
  }

  machine.oilPressureKpa =
    machine.engineRpm > 0
      ? 150 + machine.engineRpm * 0.11 + jitter(6)
      : 0;

  machine.impactG = 0.05 + Math.random() * 0.25;

  machine.nearestObjectDistanceM = Math.min(
    35,
    Math.max(12, machine.nearestObjectDistanceM + jitter(1.5))
  );
}


module.exports = {
  STATES,
  createMachine,
  updateMachineState,
  updateTelemetry,
  updateExtendedTelemetry,
};