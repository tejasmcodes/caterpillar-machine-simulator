/*
 * Sensor registry used for the machine pre-check.
 *
 * Each sensor reads a value from the live machine
 * state and grades it OK / WARN / FAIL. A SENSOR_FAULT
 * scenario overrides the grade via machine.sensorFaults.
 *
 * `critical` sensors make the whole pre-check FAIL on
 * the operator side (the backend applies that rule).
 */

const FUEL_TANK_CAPACITY_L = 400;

function grade(status, message) {
  return { status, message };
}

const SENSORS = [
  {
    sensor: "ENGINE_ECU",
    label: "Engine ECU",
    critical: true,
    read: (m) => ({ value: Math.round(m.engineRpm), unit: "rpm" }),
    grade: () => grade("OK", "ECU responding"),
  },
  {
    sensor: "FUEL_SENSOR",
    label: "Fuel level",
    critical: false,
    read: (m) => ({ value: Math.round((m.fuelLevelLitres / FUEL_TANK_CAPACITY_L) * 100), unit: "%" }),
    grade: (v) => (v < 15 ? grade("WARN", "Fuel low — refuel before shift") : grade("OK", "Within range")),
  },
  {
    sensor: "HYDRAULIC_TEMP",
    label: "Hydraulic temperature",
    critical: false,
    read: (m) => ({ value: Number(m.hydraulicTemperature.toFixed(1)), unit: "°C" }),
    grade: (v) =>
      v > 95 ? grade("FAIL", "Hydraulic oil too hot") : v > 90 ? grade("WARN", "Hydraulic oil running hot") : grade("OK", "Within range"),
  },
  {
    sensor: "ENGINE_TEMP",
    label: "Engine temperature",
    critical: false,
    read: (m) => ({ value: Number(m.engineTemperature.toFixed(1)), unit: "°C" }),
    grade: (v) =>
      v > 105 ? grade("FAIL", "Engine overheating") : v > 95 ? grade("WARN", "Engine running hot") : grade("OK", "Within range"),
  },
  {
    sensor: "OIL_PRESSURE",
    label: "Oil pressure",
    critical: false,
    read: (m) => ({ value: Math.round(m.oilPressureKpa), unit: "kPa" }),
    grade: (v, m) =>
      m.engineRpm > 800 && v < 150 ? grade("FAIL", "Oil pressure too low") : grade("OK", "Within range"),
  },
  {
    sensor: "VIBRATION",
    label: "Vibration",
    critical: false,
    read: (m) => ({ value: Number(m.vibration.toFixed(2)), unit: "g" }),
    grade: (v) =>
      v > 1.5 ? grade("FAIL", "Severe vibration") : v > 0.8 ? grade("WARN", "Vibration above normal") : grade("OK", "Within range"),
  },
  {
    sensor: "SEATBELT_SENSOR",
    label: "Seatbelt sensor",
    critical: true,
    read: (m) => ({ value: m.seatbeltStatus ? "FASTENED" : "OPEN", unit: "" }),
    grade: () => grade("OK", "Buckle switch responding"),
  },
  {
    sensor: "SEAT_PRESENCE",
    label: "Seat presence",
    critical: false,
    read: (m) => ({ value: m.operatorPresent ? "OCCUPIED" : "EMPTY", unit: "" }),
    grade: () => grade("OK", "Seat switch responding"),
  },
  {
    sensor: "GPS",
    label: "GPS",
    critical: false,
    read: (m) => ({ value: `${m.location.latitude.toFixed(4)}, ${m.location.longitude.toFixed(4)}`, unit: "" }),
    grade: () => grade("OK", "Position fix"),
  },
  {
    sensor: "PROXIMITY_FRONT",
    label: "Proximity sensor (front)",
    critical: true,
    read: (m) => ({ value: Number(m.nearestObjectDistanceM.toFixed(1)), unit: "m" }),
    grade: () => grade("OK", "Radar responding"),
  },
  {
    sensor: "PROXIMITY_REAR",
    label: "Proximity sensor (rear)",
    critical: true,
    read: (m) => ({ value: Number(m.nearestObjectDistanceM.toFixed(1)), unit: "m" }),
    grade: () => grade("OK", "Radar responding"),
  },
  {
    sensor: "TILT_SENSOR",
    label: "Tilt sensor",
    critical: true,
    read: (m) => ({ value: Number(m.tiltAngleDeg.toFixed(1)), unit: "°" }),
    grade: (v) => (v > 15 ? grade("WARN", "Machine parked on a slope") : grade("OK", "Level")),
  },
  {
    sensor: "BRAKES",
    label: "Brakes",
    critical: true,
    read: () => ({ value: "HOLDING", unit: "" }),
    grade: () => grade("OK", "Holding pressure"),
  },
  {
    sensor: "LIGHTS_HORN",
    label: "Lights and horn",
    critical: false,
    read: () => ({ value: "OK", unit: "" }),
    grade: () => grade("OK", "Circuit OK"),
  },
  {
    sensor: "CAMERA",
    label: "Camera",
    critical: false,
    read: () => ({ value: "STREAMING", unit: "" }),
    grade: () => grade("OK", "Image OK"),
  },
];

function gradeSensor(def, machine) {
  const { value, unit } = def.read(machine);
  const fault = machine.sensorFaults?.[def.sensor];
  const result = fault ? grade(fault.status, fault.message) : def.grade(value, machine);

  return {
    sensor: def.sensor,
    label: def.label,
    critical: def.critical,
    status: result.status,
    value,
    unit,
    message: result.message,
  };
}

function gradeAll(machine) {
  return SENSORS.map((def) => gradeSensor(def, machine));
}

function overallOf(sensors) {
  if (sensors.some((s) => s.critical && s.status === "FAIL")) return "FAIL";
  if (sensors.some((s) => s.status !== "OK")) return "PASS_WITH_WARNINGS";
  return "PASS";
}

module.exports = {
  SENSORS,
  gradeSensor,
  gradeAll,
  overallOf,
};
