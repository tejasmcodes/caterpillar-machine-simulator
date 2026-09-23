const SCENARIOS = {
  NORMAL: "NORMAL",

  SEATBELT_VIOLATION:
    "SEATBELT_VIOLATION",

  EXCESSIVE_IDLE:
    "EXCESSIVE_IDLE",

  OVERHEATING:
    "OVERHEATING",

  HIGH_VIBRATION:
    "HIGH_VIBRATION",

  PROXIMITY_HAZARD:
    "PROXIMITY_HAZARD",

  ABNORMAL_FUEL_CONSUMPTION:
    "ABNORMAL_FUEL_CONSUMPTION",

  MACHINE_OFFLINE:
    "MACHINE_OFFLINE",

  SENSOR_FAULT:
    "SENSOR_FAULT",

  ROLLOVER_RISK:
    "ROLLOVER_RISK",

  IMPACT:
    "IMPACT",

  WORKER_NEARBY:
    "WORKER_NEARBY",

  OPERATOR_ABSENT:
    "OPERATOR_ABSENT",

  LOW_OIL_PRESSURE:
    "LOW_OIL_PRESSURE",

  OVERLOAD:
    "OVERLOAD",
};


/*
 * -----------------------------------------
 * SCENARIO MODIFIERS
 * -----------------------------------------
 *
 * These values describe how a scenario
 * changes the machine's normal behavior.
 */

const SCENARIO_MODIFIERS = {
  NORMAL: {
    fuelConsumptionMultiplier: 1,
  },

  ABNORMAL_FUEL_CONSUMPTION: {
    /*
     * The machine consumes 60% more fuel
     * than expected for its current state.
     *
     * Example:
     *
     * Normal loading = 22 L/h
     * Abnormal loading = 35.2 L/h
     */

    fuelConsumptionMultiplier: 1.6,
  },
};


/*
 * Sensors that report a fault during SENSOR_FAULT.
 * BRAKES and PROXIMITY_REAR are critical, so the
 * operator's pre-check FAILS and the shift is blocked.
 */
const SENSOR_FAULTS = {
  BRAKES: {
    status: "FAIL",
    message: "Brake pressure not holding",
  },

  PROXIMITY_REAR: {
    status: "FAIL",
    message: "No signal from rear radar",
  },

  CAMERA: {
    status: "WARN",
    message: "Rear camera image dim",
  },
};


/*
 * -----------------------------------------
 * APPLY SCENARIO
 * -----------------------------------------
 */

function applyScenario(machine) {
  machine.fuelConsumptionMultiplier = 1;

  switch (machine.scenario) {
    case SCENARIOS.NORMAL:
      break;

    case SCENARIOS.SEATBELT_VIOLATION:
      machine.seatbeltStatus = false;
      break;

    case SCENARIOS.EXCESSIVE_IDLE:
      machine.state = "IDLE";
      machine.engineRpm = 700;
      machine.idleTime += 0.4;
      break;

    case SCENARIOS.OVERHEATING:
      /*
       * Push temperatures toward an abnormal
       * operating range instead of increasing
       * indefinitely on every tick.
       */
      machine.engineTemperature = Math.max(
        machine.engineTemperature,
        95
      );

      machine.hydraulicTemperature = Math.max(
        machine.hydraulicTemperature,
        92
      );

      break;

    case SCENARIOS.HIGH_VIBRATION:
      /*
       * Keep vibration at an abnormal but
       * bounded level.
       */
      machine.vibration = Math.max(
        machine.vibration,
        1.2
      );

      break;

    case SCENARIOS.PROXIMITY_HAZARD:
      /*
       * Proximity is ultimately a fleet-level
       * condition and should be detected by
       * the backend.
       *
       * This scenario remains available for
       * simulator/demo purposes.
       */
      machine.location.latitude = 12.9705;
      machine.location.longitude = 79.1565;
      break;

    case SCENARIOS.ABNORMAL_FUEL_CONSUMPTION:
      machine.fuelConsumptionMultiplier =
        SCENARIO_MODIFIERS
          .ABNORMAL_FUEL_CONSUMPTION
          .fuelConsumptionMultiplier;
      break;

    case SCENARIOS.MACHINE_OFFLINE:
      break;

    default:
      break;
  }
}


/*
 * -----------------------------------------
 * APPLY SCENARIO (AFTER TELEMETRY UPDATE)
 * -----------------------------------------
 *
 * Runs after updateTelemetry() in the live
 * simulator only. It drives the extended
 * telemetry fields (proximity, tilt, impact,
 * operator presence, ...) and the escalating
 * overheating ramp.
 *
 * datasetGenerator.js does not call this, so
 * the ML training dataset is unchanged.
 */

function applyScenarioAfterTelemetry(machine) {
  machine.sensorFaults = {};

  switch (machine.scenario) {
    case SCENARIOS.OVERHEATING:
      machine.overheatRamp =
        Math.min((machine.overheatRamp || 0) + 1, 20);
      machine.engineTemperature = Math.max(
        machine.engineTemperature,
        95 + machine.overheatRamp * 0.9
      );
      machine.hydraulicTemperature = Math.max(
        machine.hydraulicTemperature,
        90 + machine.overheatRamp * 0.5
      );
      break;

    case SCENARIOS.PROXIMITY_HAZARD:
      machine.nearestObjectDistanceM = 5.5;
      break;

    case SCENARIOS.WORKER_NEARBY:
      machine.nearestObjectDistanceM = 1.8;
      break;

    case SCENARIOS.ROLLOVER_RISK:
      machine.tiltAngleDeg = Math.min(
        machine.tiltAngleDeg + 4,
        19
      );
      machine.terrain = "SLOPE";
      break;

    case SCENARIOS.IMPACT:
      if (!machine.impactFired) {
        machine.impactG = 3.4;
        machine.impactFired = true;
      }
      break;

    case SCENARIOS.SENSOR_FAULT:
      machine.sensorFaults = SENSOR_FAULTS;
      break;

    case SCENARIOS.OPERATOR_ABSENT:
      machine.operatorPresent = false;
      machine.seatbeltStatus = false;
      break;

    case SCENARIOS.LOW_OIL_PRESSURE:
      if (machine.engineRpm > 800) {
        machine.oilPressureKpa = 120;
      }
      break;

    case SCENARIOS.OVERLOAD:
      if (
        machine.state === "LOADING" ||
        machine.state === "TRANSPORTING"
      ) {
        machine.loadWeightKg = 6200;
      }
      break;

    default:
      break;
  }

  if (machine.scenario !== SCENARIOS.OVERHEATING) {
    machine.overheatRamp = 0;
  }

  if (machine.scenario !== SCENARIOS.IMPACT) {
    machine.impactFired = false;
  }
}


/*
 * -----------------------------------------
 * SEATBELT UPDATE
 * -----------------------------------------
 *
 * Normal machines have the seatbelt
 * engaged.
 *
 * A seatbelt violation forces it to false.
 */

function updateSeatbelt(machine) {
  if (
    machine.scenario !==
    SCENARIOS.SEATBELT_VIOLATION
  ) {
    machine.seatbeltStatus = true;
  }
}


module.exports = {
  SCENARIOS,
  SCENARIO_MODIFIERS,
  SENSOR_FAULTS,
  applyScenario,
  applyScenarioAfterTelemetry,
  updateSeatbelt,
};
