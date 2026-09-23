require("dotenv").config();

const { SCENARIOS } = require("./scenarios");

const VALID_SCENARIOS = Object.values(SCENARIOS);

const VALID_WEATHER = ["CLEAR", "RAIN", "FOG"];
const VALID_VISIBILITY = ["GOOD", "LOW"];

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

  heartbeatIntervalMs: getNumberEnv(
    "HEARTBEAT_INTERVAL_MS",
    5000
  ),

  siteConditionsIntervalMs: getNumberEnv(
    "SITE_CONDITIONS_INTERVAL_MS",
    60000
  ),

  controlPort: getNumberEnv(
    "CONTROL_PORT",
    3000
  ),

  siteWeather: process.env.SITE_WEATHER || "CLEAR",

  siteVisibility: process.env.SITE_VISIBILITY || "GOOD",

  siteAmbientTempC: getNumberEnv(
    "SITE_AMBIENT_TEMP_C",
    31
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

  if (!VALID_WEATHER.includes(config.siteWeather)) {
    throw new Error(`SITE_WEATHER must be one of ${VALID_WEATHER.join(", ")}`);
  }

  if (!VALID_VISIBILITY.includes(config.siteVisibility)) {
    throw new Error(`SITE_VISIBILITY must be one of ${VALID_VISIBILITY.join(", ")}`);
  }
}

module.exports = {
  config,
  VALID_SCENARIOS,
  VALID_WEATHER,
  VALID_VISIBILITY,
  validateConfig,
};
