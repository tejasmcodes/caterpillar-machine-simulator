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
  /*
   * Reset the scenario-dependent fuel
   * multiplier every tick.
   *
   * This prevents a multiplier from
   * accumulating like:
   *
   * 1.6 → 2.56 → 4.09 → ...
   */

  machine.fuelConsumptionMultiplier = 1;


  switch (machine.scenario) {
    /*
     * ---------------------------------------
     * NORMAL
     * ---------------------------------------
     */

    case SCENARIOS.NORMAL:
      break;


    /*
     * ---------------------------------------
     * SEATBELT VIOLATION
     * ---------------------------------------
     */

    case SCENARIOS.SEATBELT_VIOLATION:

      machine.seatbeltStatus = false;

      break;


    /*
     * ---------------------------------------
     * EXCESSIVE IDLE
     * ---------------------------------------
     *
     * The machine remains in IDLE instead
     * of progressing through the normal
     * operating cycle.
     */

    case SCENARIOS.EXCESSIVE_IDLE:

      machine.state = "IDLE";

      machine.engineRpm = 700;

      /*
       * This is additional idle duration
       * associated with the abnormal
       * scenario.
       */

      machine.idleTime += 0.4;

      break;


    /*
     * ---------------------------------------
     * OVERHEATING
     * ---------------------------------------
     */

    case SCENARIOS.OVERHEATING:

      machine.engineTemperature += 3;

      machine.hydraulicTemperature += 2;

      break;


    /*
     * ---------------------------------------
     * HIGH VIBRATION
     * ---------------------------------------
     */

    case SCENARIOS.HIGH_VIBRATION:

      machine.vibration += 0.25;

      break;


    /*
     * ---------------------------------------
     * PROXIMITY HAZARD
     * ---------------------------------------
     *
     * For the initial demonstration,
     * machines using this scenario are
     * positioned in the same geographic
     * region.
     */

    case SCENARIOS.PROXIMITY_HAZARD:

      machine.location.latitude =
        12.9705;

      machine.location.longitude =
        79.1565;

      break;


    /*
     * ---------------------------------------
     * ABNORMAL FUEL CONSUMPTION
     * ---------------------------------------
     *
     * Do NOT directly modify:
     *
     * fuelConsumedLitres
     *
     * Instead, modify the operating
     * condition and allow machine.js
     * to calculate the resulting fuel
     * consumption.
     */

    case SCENARIOS.ABNORMAL_FUEL_CONSUMPTION:

      machine.fuelConsumptionMultiplier =
        SCENARIO_MODIFIERS
          .ABNORMAL_FUEL_CONSUMPTION
          .fuelConsumptionMultiplier;

      break;


    /*
     * ---------------------------------------
     * MACHINE OFFLINE
     * ---------------------------------------
     *
     * The simulator handles this scenario
     * before telemetry is generated.
     */

    case SCENARIOS.MACHINE_OFFLINE:

      break;


    /*
     * ---------------------------------------
     * UNKNOWN SCENARIO
     * ---------------------------------------
     */

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