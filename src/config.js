require("dotenv").config();

const VALID_SCENARIOS = [
  "NORMAL",
  "SEATBELT_VIOLATION",
  "EXCESSIVE_IDLE",
  "OVERHEATING",
  "HIGH_VIBRATION",
  "PROXIMITY_HAZARD",
  "ABNORMAL_FUEL_CONSUMPTION",
  "MACHINE_OFFLINE",
];

function getNumberEnv(name, defaultValue) {
  const value = process.env[name];

  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be a valid number`);
  }

  return parsed;
}

const config = {
  machineId: process.env.MACHINE_ID || "EXC001",

  mqttBrokerUrl:
    process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",

  scenario:
    process.env.SCENARIO || "NORMAL",

  intervalMs: getNumberEnv(
    "SIMULATOR_INTERVAL_MS",
    4000
  ),

  latitude: getNumberEnv(
    "MACHINE_LATITUDE",
    12.97
  ),

  longitude: getNumberEnv(
    "MACHINE_LONGITUDE",
    79.156
  ),
};

function validateConfig() {
  if (!config.machineId.trim()) {
    throw new Error("MACHINE_ID cannot be empty");
  }

  if (!VALID_SCENARIOS.includes(config.scenario)) {
    throw new Error(
      `Invalid SCENARIO "${config.scenario}". ` +
      `Valid scenarios: ${VALID_SCENARIOS.join(", ")}`
    );
  }

  if (config.intervalMs < 500) {
    throw new Error(
      "SIMULATOR_INTERVAL_MS must be at least 500ms"
    );
  }
}

module.exports = {
  config,
  VALID_SCENARIOS,
  validateConfig,
};