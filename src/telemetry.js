function createTelemetryPayload(machine) {
  return {
    /*
     * -------------------------
     * MACHINE IDENTITY
     * -------------------------
     */

    machineId: machine.machineId,

    timestamp: new Date().toISOString(),

    /*
     * -------------------------
     * MACHINE STATE
     * -------------------------
     */

    state: machine.state,

    scenario: machine.scenario,

    /*
     * -------------------------
     * ENGINE
     * -------------------------
     */

    engineHours: Number(
      machine.engineHours.toFixed(2)
    ),

    /*
     * -------------------------
     * FUEL
     * -------------------------
     *
     * fuelLevelLitres:
     * Current fuel remaining in the tank.
     *
     * fuelConsumedLitres:
     * Cumulative fuel consumed.
     *
     * fuelConsumptionRateLph:
     * Current consumption rate in litres/hour.
     */

    fuelLevelLitres: Number(
      machine.fuelLevelLitres.toFixed(2)
    ),

    fuelConsumedLitres: Number(
      machine.fuelConsumedLitres.toFixed(2)
    ),

    fuelConsumptionRateLph: Number(
      machine.fuelConsumptionRateLph.toFixed(2)
    ),

    /*
     * -------------------------
     * WORKLOAD
     * -------------------------
     */

    loadCycles: machine.loadCycles,

    idleTime: Number(
      machine.idleTime.toFixed(2)
    ),

    /*
     * -------------------------
     * ENGINE / MACHINE HEALTH
     * -------------------------
     */

    engineRpm: Math.round(
      machine.engineRpm
    ),

    engineTemperature: Number(
      machine.engineTemperature.toFixed(1)
    ),

    hydraulicTemperature: Number(
      machine.hydraulicTemperature.toFixed(1)
    ),

    vibration: Number(
      machine.vibration.toFixed(2)
    ),

    /*
     * -------------------------
     * SAFETY
     * -------------------------
     */

    seatbeltStatus:
      machine.seatbeltStatus,

    operatorId:
      machine.operatorId,

    operatorPresent:
      machine.operatorPresent,

    hydraulicLockout:
      machine.hydraulicLockout,

    parkingBrake:
      machine.parkingBrake,

    nearestObjectDistanceM: Number(
      machine.nearestObjectDistanceM.toFixed(1)
    ),

    impactG: Number(
      machine.impactG.toFixed(2)
    ),

    /*
     * -------------------------
     * MOTION / LOAD
     * -------------------------
     */

    speedKph: Number(
      machine.speedKph.toFixed(1)
    ),

    tiltAngleDeg: Number(
      machine.tiltAngleDeg.toFixed(1)
    ),

    swingAngleDeg: Math.round(
      machine.swingAngleDeg
    ),

    boomHeightM: Number(
      machine.boomHeightM.toFixed(1)
    ),

    loadWeightKg: Math.round(
      machine.loadWeightKg
    ),

    ratedCapacityKg:
      machine.ratedCapacityKg,

    oilPressureKpa: Math.round(
      machine.oilPressureKpa
    ),

    terrain:
      machine.terrain,

    /*
     * -------------------------
     * LOCATION
     * -------------------------
     */

    location: {
      latitude: Number(
        machine.location.latitude.toFixed(6)
      ),

      longitude: Number(
        machine.location.longitude.toFixed(6)
      ),
    },
  };
}

module.exports = {
  createTelemetryPayload,
};