const mqtt = require("mqtt");

const {
  config,
  validateConfig,
} = require("./config");

const {
  createMachine,
  updateMachineState,
  updateTelemetry,
} = require("./machine");

const {
  SCENARIOS,
  applyScenario,
  updateSeatbelt,
} = require("./scenarios");

const {
  createTelemetryPayload,
} = require("./telemetry");


/*
 * -----------------------------------------
 * CONFIGURATION
 * -----------------------------------------
 */

validateConfig();


/*
 * -----------------------------------------
 * MQTT
 * -----------------------------------------
 */

const mqttClient = mqtt.connect(
  config.mqttBrokerUrl,
  {
    clientId:
      `machine-simulator-${config.machineId}-${Date.now()}`,

    clean: true,

    reconnectPeriod: 3000,

    connectTimeout: 5000,
  }
);

const telemetryTopic =
  `machines/${config.machineId}/telemetry`;

const controlTopic =
  `machines/${config.machineId}/control`;
/*
 * -----------------------------------------
 * MACHINE
 * -----------------------------------------
 */

const machine = createMachine({
  machineId: config.machineId,

  scenario: config.scenario,

  latitude: config.latitude,

  longitude: config.longitude,
});



/*
 * -----------------------------------------
 * LOGGING
 * -----------------------------------------
 */

console.log("\n========================================");

console.log(
  "      CATERPILLAR MACHINE SIMULATOR"
);

console.log("========================================");

console.log(
  `Machine ID       : ${config.machineId}`
);

console.log(
  `Scenario         : ${config.scenario}`
);

console.log(
  `MQTT Broker      : ${config.mqttBrokerUrl}`
);

console.log(
  `Telemetry Topic  : ${telemetryTopic}`
);

console.log(
  `Interval         : ${config.intervalMs} ms`
);

console.log("========================================\n");


/*
 * -----------------------------------------
 * MQTT CONNECTION
 * -----------------------------------------
 */

mqttClient.on("connect", () => {
  console.log(
    `[MQTT] Connected to ${config.mqttBrokerUrl}`
  );

  console.log(
    `[MQTT] Publishing telemetry to ${telemetryTopic}`
  );

  if (
    config.scenario ===
    SCENARIOS.MACHINE_OFFLINE
  ) {
    console.log(
      `[SIMULATION] ${config.machineId} is configured as OFFLINE`
    );
  }
});


mqttClient.on("reconnect", () => {
  console.log(
    "[MQTT] Attempting to reconnect..."
  );
});


mqttClient.on("error", (error) => {
  console.error(
    `[MQTT] Error: ${error.message}`
  );
});


mqttClient.on("close", () => {
  console.log(
    "[MQTT] Connection closed"
  );
});


/*
 * -----------------------------------------
 * TELEMETRY PUBLISHING
 * -----------------------------------------
 */

function publishTelemetry(payload) {
  const message = JSON.stringify(payload);

  mqttClient.publish(
    telemetryTopic,
    message,
    {
      qos: 1,
      retain: false,
    },
    (error) => {
      if (error) {
        console.error(
          `[MQTT] Publish failed: ${error.message}`
        );

        return;
      }

      console.log(
        `[MQTT] ${payload.machineId} | ` +
        `State: ${payload.state} | ` +
        `Scenario: ${payload.scenario} | ` +
        `RPM: ${payload.engineRpm} | ` +
        `Temp: ${payload.engineTemperature}°C | ` +
        `Vibration: ${payload.vibration} | ` +
        `Fuel: ${payload.fuelConsumptionRateLph} L/h | ` +
        `Fuel Level: ${payload.fuelLevelLitres} L`
      );
    }
  );
}


/*
 * -----------------------------------------
 * SIMULATION TICK
 * -----------------------------------------
 */

let cycleCount = 0;

function runSimulationTick() {
  cycleCount++;

  console.log(
    `\n--- Simulation Cycle #${cycleCount} ---`
  );


  /*
   * ---------------------------------------
   * MACHINE OFFLINE
   * ---------------------------------------
   *
   * An offline machine intentionally does
   * not publish telemetry.
   */

  if (
    machine.scenario ===
    SCENARIOS.MACHINE_OFFLINE
  ) {
    console.log(
      `[OFFLINE] ${machine.machineId} | No telemetry published`
    );

    return;
  }


  /*
   * ---------------------------------------
   * UPDATE MACHINE STATE
   * ---------------------------------------
   *
   * EXCESSIVE_IDLE deliberately prevents
   * normal state progression.
   */

  if (
    machine.scenario !==
    SCENARIOS.EXCESSIVE_IDLE
  ) {
    updateMachineState(machine);
  }


  /*
   * ---------------------------------------
   * APPLY SCENARIO
   * ---------------------------------------
   *
   * IMPORTANT:
   *
   * Scenario modifications happen BEFORE
   * telemetry calculation.
   *
   * This allows scenarios such as
   * ABNORMAL_FUEL_CONSUMPTION to modify
   * the conditions used by updateTelemetry().
   */

  applyScenario(machine);


  /*
   * ---------------------------------------
   * UPDATE TELEMETRY
   * ---------------------------------------
   *
   * Pass the actual configured interval.
   *
   * Example:
   *
   * 4000 ms → 4 seconds
   * 2000 ms → 2 seconds
   * 10000 ms → 10 seconds
   */

  updateTelemetry(
    machine,
    config.intervalMs
  );


  /*
   * ---------------------------------------
   * UPDATE SAFETY STATUS
   * ---------------------------------------
   */

  updateSeatbelt(machine);


  /*
   * ---------------------------------------
   * CREATE TELEMETRY PAYLOAD
   * ---------------------------------------
   */

  const payload =
    createTelemetryPayload(machine);


  /*
   * ---------------------------------------
   * PUBLISH OVER MQTT
   * ---------------------------------------
   */

  publishTelemetry(payload);
}


/*
 * -----------------------------------------
 * START SIMULATION
 * -----------------------------------------
 */

const simulationInterval =
  setInterval(
    runSimulationTick,
    config.intervalMs
  );


/*
 * -----------------------------------------
 * GRACEFUL SHUTDOWN
 * -----------------------------------------
 */

function shutdown(signal) {
  console.log(
    `\n[SIMULATOR] Received ${signal}`
  );

  clearInterval(simulationInterval);

  mqttClient.end(
    false,
    {},
    () => {
      console.log(
        "[MQTT] Disconnected"
      );

      console.log(
        "[SIMULATOR] Shutdown complete"
      );

      process.exit(0);
    }
  );
}


process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);


process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);