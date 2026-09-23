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
 * RUNTIME STATE
 * -----------------------------------------
 *
 * The simulator is not tied to a machine
 * until startSimulator() is called.
 *
 * This allows the UI to select:
 *
 * MACHINE-001
 * MACHINE-002
 * MACHINE-003
 *
 * before the simulator starts.
 * -----------------------------------------
 */

let machine = null;

let mqttClient = null;

let simulationInterval = null;

let scenarioTimer = null;

let telemetryTopic = null;

let controlTopic = null;

let cycleCount = 0;


/*
 * -----------------------------------------
 * START SIMULATOR
 * -----------------------------------------
 */

function startSimulator(machineId) {

  /*
   * Prevent starting the simulator twice.
   */

  if (machine) {
    throw new Error(
      "Simulator is already running"
    );
  }


  /*
   * Create the machine.
   */

  machine = createMachine({
    machineId,

    scenario:
      config.scenario,

    latitude:
      config.latitude,

    longitude:
      config.longitude,
  });


  /*
   * MQTT topics depend on the selected
   * machine ID.
   */

  telemetryTopic =
    `machines/${machineId}/telemetry`;

  controlTopic =
    `machines/${machineId}/control`;


  /*
   * Create MQTT client.
   */

  mqttClient = mqtt.connect(
    config.mqttBrokerUrl,
    {
      clientId:
        `machine-simulator-${machineId}-${Date.now()}`,

      clean: true,

      reconnectPeriod: 3000,

      connectTimeout: 5000,
    }
  );


  /*
   * ---------------------------------------
   * LOGGING
   * ---------------------------------------
   */

  console.log(
    "\n========================================"
  );

  console.log(
    "      CATERPILLAR MACHINE SIMULATOR"
  );

  console.log(
    "========================================"
  );

  console.log(
    `Machine ID       : ${machineId}`
  );

  console.log(
    `Initial Scenario : ${config.scenario}`
  );

  console.log(
    `MQTT Broker      : ${config.mqttBrokerUrl}`
  );

  console.log(
    `Telemetry Topic  : ${telemetryTopic}`
  );

  console.log(
    `Control Topic    : ${controlTopic}`
  );

  console.log(
    `Interval         : ${config.intervalMs} ms`
  );

  console.log(
    "========================================\n"
  );


  /*
   * ---------------------------------------
   * MQTT CONNECTION
   * ---------------------------------------
   */

  mqttClient.on(
    "connect",
    () => {

      console.log(
        `[MQTT] Connected to ${config.mqttBrokerUrl}`
      );

      console.log(
        `[MQTT] Publishing telemetry to ${telemetryTopic}`
      );

      console.log(
        `[MQTT] Machine ${machineId} is ready`
      );

    }
  );


  mqttClient.on(
    "reconnect",
    () => {

      console.log(
        "[MQTT] Attempting to reconnect..."
      );

    }
  );


  mqttClient.on(
    "error",
    (error) => {

      console.error(
        `[MQTT] Error: ${error.message}`
      );

    }
  );


  mqttClient.on(
    "close",
    () => {

      console.log(
        "[MQTT] Connection closed"
      );

    }
  );


  /*
   * ---------------------------------------
   * START TELEMETRY LOOP
   * ---------------------------------------
   */

  simulationInterval =
    setInterval(
      runSimulationTick,
      config.intervalMs
    );


  /*
   * Run the first tick immediately.
   */

  runSimulationTick();


  console.log(
    `[SIMULATOR] Started ${machineId}`
  );

}


/*
 * -----------------------------------------
 * SCENARIO CONTROL
 * -----------------------------------------
 */

function setScenario(
  scenario,
  durationSeconds
) {

  if (!machine) {
    throw new Error(
      "Simulator has not been started"
    );
  }


  /*
   * Clear an existing scenario timer.
   */

  if (scenarioTimer) {

    clearTimeout(
      scenarioTimer
    );

    scenarioTimer = null;

  }


  /*
   * Change the machine's active scenario.
   */

  machine.scenario =
    scenario;


  console.log(
    `\n[SCENARIO] ${machine.machineId} → ${scenario}`
  );

  console.log(
    `[SCENARIO] Duration: ${durationSeconds} seconds`
  );


  /*
   * NORMAL does not need an automatic
   * reset timer.
   */

  if (
    scenario ===
    SCENARIOS.NORMAL
  ) {

    return;

  }


  /*
   * Automatically return to NORMAL.
   */

  scenarioTimer =
    setTimeout(
      () => {

        if (!machine) {
          return;
        }


        machine.scenario =
          SCENARIOS.NORMAL;


        scenarioTimer = null;


        console.log(
          `\n[SCENARIO] ${machine.machineId} → NORMAL`
        );

        console.log(
          "[SCENARIO] Automatic reset"
        );

      },

      durationSeconds * 1000
    );

}


/*
 * -----------------------------------------
 * STOP SCENARIO
 * -----------------------------------------
 */

function stopScenario() {

  if (!machine) {
    return;
  }


  /*
   * Cancel automatic reset timer.
   */

  if (scenarioTimer) {

    clearTimeout(
      scenarioTimer
    );

    scenarioTimer = null;

  }


  /*
   * Return machine to normal.
   */

  machine.scenario =
    SCENARIOS.NORMAL;


  console.log(
    `\n[SCENARIO] ${machine.machineId} → NORMAL`
  );

  console.log(
    "[SCENARIO] Stopped manually"
  );

}


/*
 * -----------------------------------------
 * CURRENT STATUS
 * -----------------------------------------
 */

function getSimulatorStatus() {

  if (!machine) {

    return {
      started: false,

      machineId: null,

      scenario: null,
    };

  }


  return {

    started: true,

    machineId:
      machine.machineId,

    scenario:
      machine.scenario,

  };

}


/*
 * -----------------------------------------
 * TELEMETRY PUBLISHING
 * -----------------------------------------
 */

function publishTelemetry(
  payload
) {

  if (!mqttClient) {
    return;
  }


  const message =
    JSON.stringify(payload);


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

function runSimulationTick() {

  if (!machine) {
    return;
  }


  cycleCount++;


  console.log(
    `\n--- Simulation Cycle #${cycleCount} ---`
  );


  /*
   * ---------------------------------------
   * MACHINE OFFLINE
   * ---------------------------------------
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

    updateMachineState(
      machine
    );

  }


  /*
   * ---------------------------------------
   * APPLY SCENARIO
   * ---------------------------------------
   *
   * scenarios.js reads:
   *
   * machine.scenario
   *
   * This value can now be changed at
   * runtime through the UI.
   */

  applyScenario(
    machine
  );


  /*
   * ---------------------------------------
   * UPDATE TELEMETRY
   * ---------------------------------------
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

  updateSeatbelt(
    machine
  );


  /*
   * ---------------------------------------
   * CREATE TELEMETRY PAYLOAD
   * ---------------------------------------
   */

  const payload =
    createTelemetryPayload(
      machine
    );


  /*
   * ---------------------------------------
   * PUBLISH OVER MQTT
   * ---------------------------------------
   */

  publishTelemetry(
    payload
  );

}


/*
 * -----------------------------------------
 * SHUTDOWN
 * -----------------------------------------
 */

function shutdown(
  signal
) {

  console.log(
    `\n[SIMULATOR] Received ${signal}`
  );


  /*
   * Stop telemetry loop.
   */

  if (simulationInterval) {

    clearInterval(
      simulationInterval
    );

    simulationInterval = null;

  }


  /*
   * Stop scenario timer.
   */

  if (scenarioTimer) {

    clearTimeout(
      scenarioTimer
    );

    scenarioTimer = null;

  }


  /*
   * Disconnect MQTT.
   */

  if (mqttClient) {

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

  } else {

    process.exit(0);

  }

}


process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);


/*
 * -----------------------------------------
 * EXPORTS
 * -----------------------------------------
 */

module.exports = {

  startSimulator,

  setScenario,

  stopScenario,

  getSimulatorStatus,

};