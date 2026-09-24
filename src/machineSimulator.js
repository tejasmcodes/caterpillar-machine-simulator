const mqtt = require("mqtt");

const {
  config,
  validateConfig,
} = require("./config");

const {
  createMachine,
  updateMachineState,
  updateTelemetry,
  updateExtendedTelemetry,
} = require("./machine");

const {
  SCENARIOS,
  applyScenario,
  applyScenarioAfterTelemetry,
  updateSeatbelt,
} = require("./scenarios");

const {
  createTelemetryPayload,
} = require("./telemetry");

const {
  createCommandHandler,
} = require("./commands");

const {
  WORKING_STATES,
  createHazardController,
} = require("./hazards");

// While a manual hazard is on, the current snapshot is re-published this often
// so the operator dashboard reacts within seconds instead of waiting a full tick.
const HAZARD_REPUBLISH_MS = 1000;


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

let heartbeatInterval = null;

let siteInterval = null;

let lastPublishedState = null;

let hazardInterval = null;

const hazards = createHazardController();

const startedAt = Date.now();

let siteConditions = {
  weather: config.siteWeather,
  visibility: config.siteVisibility,
  ambientTempC: config.siteAmbientTempC,
};

const commandHandler = createCommandHandler({
  getMachine: () => machine,
  isOffline: () =>
    !machine || machine.scenario === SCENARIOS.MACHINE_OFFLINE,
  publish: publishJson,
  publishEvent,
});


/*
 * -----------------------------------------
 * MQTT HELPERS
 * -----------------------------------------
 */

function publishJson(topic, payload, qos = 1) {
  if (!mqttClient) {
    return;
  }

  mqttClient.publish(
    topic,
    JSON.stringify(payload),
    { qos, retain: false },
    (error) => {
      if (error) {
        console.error(`[MQTT] Publish to ${topic} failed: ${error.message}`);
      }
    }
  );
}

function publishEvent(type, severity, data = {}) {
  if (!machine) {
    return;
  }

  publishJson(`machines/${machine.machineId}/events`, {
    machineId: machine.machineId,
    type,
    severity,
    data,
    timestamp: new Date().toISOString(),
  });
}

function publishHeartbeat() {
  if (!machine || machine.scenario === SCENARIOS.MACHINE_OFFLINE) {
    return;
  }

  publishJson(
    `machines/${machine.machineId}/heartbeat`,
    {
      machineId: machine.machineId,
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    },
    0
  );
}

function publishSiteConditions() {
  publishJson(
    "site/conditions",
    {
      ...siteConditions,
      source: machine ? machine.machineId : null,
      timestamp: new Date().toISOString(),
    },
    0
  );
}

function publishStateIfChanged() {
  if (machine.state === lastPublishedState) {
    return;
  }

  publishJson(`machines/${machine.machineId}/state`, {
    machineId: machine.machineId,
    state: machine.state,
    previousState: lastPublishedState,
    timestamp: new Date().toISOString(),
  });

  lastPublishedState = machine.state;
}


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

      mqttClient.subscribe(
        `machines/${machineId}/commands/#`,
        { qos: 1 },
        (error) => {
          if (error) {
            console.error(`[MQTT] Command subscribe failed: ${error.message}`);
          } else {
            console.log(`[MQTT] Listening for commands on machines/${machineId}/commands/#`);
          }
        }
      );

      publishSiteConditions();

    }
  );


  mqttClient.on(
    "message",
    (topic, message) => {

      let payload = {};

      try {
        payload = JSON.parse(message.toString() || "{}");
      } catch (error) {
        console.error(`[MQTT] Invalid command JSON on ${topic}`);
        return;
      }

      commandHandler.handle(topic, payload);

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


  heartbeatInterval =
    setInterval(
      publishHeartbeat,
      config.heartbeatIntervalMs
    );

  hazardInterval =
    setInterval(
      republishForHazards,
      HAZARD_REPUBLISH_MS
    );

  siteInterval =
    setInterval(
      publishSiteConditions,
      config.siteConditionsIntervalMs
    );


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
   * Seatbelt / operator / oil hazards only matter
   * while the machine works, so keep it working
   * while one of them is switched on.
   */

  if (
    hazards.needsWork() &&
    !WORKING_STATES.has(machine.state)
  ) {

    machine.state = "OPERATING";

    machine.stateTicks = 0;

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
   * EXTENDED SAFETY TELEMETRY + SCENARIO
   * ---------------------------------------
   */

  updateExtendedTelemetry(
    machine
  );

  applyScenarioAfterTelemetry(
    machine
  );

  publishStateIfChanged();

  if (machine.impactG > 2.5) {
    publishEvent("IMPACT", "CRITICAL", {
      impactG: Number(machine.impactG.toFixed(2)),
    });
  }


  /*
   * ---------------------------------------
   * CREATE TELEMETRY PAYLOAD
   * ---------------------------------------
   */

  const payload =
    createTelemetryPayload(
      withHazards(machine)
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

  clearInterval(heartbeatInterval);

  clearInterval(hazardInterval);

  clearInterval(siteInterval);


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

/*
 * -----------------------------------------
 * CONTROL UI HELPERS
 * -----------------------------------------
 */

function getLatestTelemetry() {
  return machine ? createTelemetryPayload(withHazards(machine)) : null;
}

function getSiteConditions() {
  return siteConditions;
}

function setSiteConditions(next) {
  siteConditions = { ...siteConditions, ...next };
  publishSiteConditions();
  return siteConditions;
}

function canPublish() {
  return !!machine && machine.scenario !== SCENARIOS.MACHINE_OFFLINE;
}

// Manual hazards change what the sensors report, not the simulated machine,
// so switching one off returns straight to the real values.
function withHazards(m) {
  if (!hazards.anyActive()) {
    return m;
  }
  const copy = { ...m, location: { ...m.location } };
  hazards.apply(copy);
  return copy;
}

// Re-send the current snapshot (with the hazards applied) without advancing
// the simulation, so fuel, engine hours and load cycles are not affected.
function publishSnapshotNow() {
  if (!canPublish()) {
    return;
  }
  publishJson(telemetryTopic, createTelemetryPayload(withHazards(machine)));
}

function republishForHazards() {
  if (hazards.anyActive()) {
    publishSnapshotNow();
  }
}

function requireMachine() {
  if (!machine) {
    throw new Error("Simulator has not been started");
  }
}

function setHazard(id, active, value) {
  requireMachine();
  const result = hazards.set(id, active, value);
  console.log(`[HAZARD] ${machine.machineId} ${id} ${active ? `ON${value !== undefined ? ` (${value})` : ""}` : "OFF"}`);

  if (active && hazards.needsWork() && !WORKING_STATES.has(machine.state)) {
    machine.state = "OPERATING";
    machine.stateTicks = 0;
  }
  publishSnapshotNow();
  return result;
}

function clearHazards() {
  requireMachine();
  const result = hazards.clearAll();
  console.log(`[HAZARD] ${machine.machineId} all cleared`);
  publishSnapshotNow();
  return result;
}

// One-shot collision: a single 3.4 g reading plus an IMPACT event.
function triggerImpact(g = 3.4) {
  requireMachine();
  if (!canPublish()) {
    throw new Error("Machine is offline");
  }
  publishJson(telemetryTopic, createTelemetryPayload({ ...withHazards(machine), impactG: g }));
  publishEvent("IMPACT", "CRITICAL", { impactG: g, source: "MACHINE_SIDE" });
  console.log(`[HAZARD] ${machine.machineId} IMPACT ${g} g`);
  return { impactG: g };
}

function soundHorn() {
  if (!machine) {
    throw new Error("Simulator has not been started");
  }
  commandHandler.soundHorn("MACHINE_SIDE");
}


module.exports = {

  startSimulator,

  setScenario,

  stopScenario,

  getSimulatorStatus,

  getLatestTelemetry,

  getSiteConditions,

  setSiteConditions,

  soundHorn,

  hazards: {
    list: () => hazards.list(),
    set: setHazard,
    clearAll: clearHazards,
    impact: triggerImpact,
  },

  precheck: {
    getPanel: () => commandHandler.getPanel(),
    setMode: (mode) => commandHandler.setMode(mode),
    verify: (sensor, status, note) => commandHandler.verify(sensor, status, note),
    markAllOk: () => commandHandler.markAllOk(),
    submit: () => commandHandler.submit(),
  },

};