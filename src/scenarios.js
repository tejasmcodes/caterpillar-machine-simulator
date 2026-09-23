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
  applyScenario,
  updateSeatbelt,
};