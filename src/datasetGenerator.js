const fs = require("fs");
const path = require("path");

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

const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "data"
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  "anomaly_detection_dataset.csv"
);

/*
 * Three machine instances.
 *
 * Same machine model, slightly different
 * starting locations.
 */
const MACHINES = [
  {
    machineId: "EXC001",
    latitude: 12.970000,
    longitude: 79.156000,
  },
  {
    machineId: "EXC002",
    latitude: 12.971000,
    longitude: 79.157000,
  },
  {
    machineId: "EXC003",
    latitude: 12.972000,
    longitude: 79.158000,
  },
];

/*
 * Scenarios relevant to machine anomaly detection.
 *
 * We intentionally exclude:
 *
 * SEATBELT_VIOLATION
 *   → deterministic safety rule
 *
 * PROXIMITY_HAZARD
 *   → fleet-level rule
 *
 * MACHINE_OFFLINE
 *   → heartbeat / last-seen detection
 */
const EPISODE_TEMPLATES = [
  {
    scenario: SCENARIOS.NORMAL,
    ticks: 600,
  },

  {
    scenario: SCENARIOS.OVERHEATING,
    ticks: 300,
  },

  {
    scenario: SCENARIOS.NORMAL,
    ticks: 600,
  },

  {
    scenario: SCENARIOS.HIGH_VIBRATION,
    ticks: 300,
  },

  {
    scenario: SCENARIOS.NORMAL,
    ticks: 600,
  },

  {
    scenario:
      SCENARIOS.ABNORMAL_FUEL_CONSUMPTION,
    ticks: 300,
  },

  {
    scenario: SCENARIOS.NORMAL,
    ticks: 600,
  },

  {
    scenario: SCENARIOS.EXCESSIVE_IDLE,
    ticks: 300,
  },

  {
    scenario: SCENARIOS.NORMAL,
    ticks: 600,
  },
];

/*
 * Simulated telemetry interval.
 *
 * 4 seconds per tick.
 *
 * This is NOT real waiting time.
 */
const INTERVAL_MS = 4000;


/*
 * CSV HEADER
 *
 * scenario and isAnomaly are kept for
 * evaluation/ground truth.
 *
 * They must NOT be used as model features.
 */
function createCsvHeader() {
  return [
    "machineId",
    "timestamp",

    "state",
    "scenario",

    "engineHours",

    "fuelLevelLitres",
    "fuelConsumedLitres",
    "fuelConsumptionRateLph",

    "loadCycles",
    "idleTime",

    "engineRpm",
    "engineTemperature",
    "hydraulicTemperature",
    "vibration",

    "idleRatio",
    "loadCyclesPerHour",
    "fuelPerLoadCycle",

    "isAnomaly",
  ].join(",");
}


/*
 * Escape values for CSV.
 */
function escapeCsvValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll(
      '"',
      '""'
    )}"`;
  }

  return stringValue;
}


/*
 * Calculate features that will later be
 * useful for anomaly detection.
 */
function calculateFeatures(payload) {
  /*
   * engineHours is cumulative operating
   * time in hours.
   */
  const engineHours =
    Math.max(
      payload.engineHours,
      0.01
    );

  /*
   * Convert operating hours to minutes.
   */
  const totalMinutes =
    engineHours * 60;

  /*
   * Percentage of operating time spent idle.
   */
  const idleRatio =
    totalMinutes > 0
      ? payload.idleTime / totalMinutes
      : 0;

  /*
   * Number of load cycles completed
   * per operating hour.
   */
  const loadCyclesPerHour =
    payload.loadCycles /
    engineHours;

  /*
   * Cumulative fuel consumed per
   * completed load cycle.
   */
  const fuelPerLoadCycle =
    payload.loadCycles > 0
      ? payload.fuelConsumedLitres /
        payload.loadCycles
      : 0;

  /*
   * Ground-truth label.
   *
   * Used ONLY to evaluate the model.
   */
  const isAnomaly =
    payload.scenario !==
    SCENARIOS.NORMAL;

  return {
    idleRatio,
    loadCyclesPerHour,
    fuelPerLoadCycle,
    isAnomaly,
  };
}


/*
 * Convert one telemetry record into
 * a CSV row.
 */
function createCsvRow(
  payload,
  features
) {
  return [
    payload.machineId,
    payload.timestamp,

    payload.state,
    payload.scenario,

    payload.engineHours,

    payload.fuelLevelLitres,
    payload.fuelConsumedLitres,
    payload.fuelConsumptionRateLph,

    payload.loadCycles,
    payload.idleTime,

    payload.engineRpm,
    payload.engineTemperature,
    payload.hydraulicTemperature,
    payload.vibration,

    features.idleRatio.toFixed(4),
    features.loadCyclesPerHour.toFixed(4),
    features.fuelPerLoadCycle.toFixed(4),

    features.isAnomaly,
  ]
    .map(escapeCsvValue)
    .join(",");
}


/*
 * Generate one continuous scenario episode.
 */
function runEpisode(
  machine,
  scenario,
  ticks,
  startTimestamp
) {
  const rows = [];

  /*
   * Change the machine scenario.
   */
  machine.scenario = scenario;

  let currentTimestamp =
    startTimestamp;

  for (
    let tick = 0;
    tick < ticks;
    tick++
  ) {
    /*
     * Excessive idle intentionally keeps
     * the machine in IDLE.
     */
    if (
      machine.scenario !==
      SCENARIOS.EXCESSIVE_IDLE
    ) {
      updateMachineState(machine);
    }

    /*
     * Apply scenario-specific behavior.
     */
    applyScenario(machine);

    /*
     * Update normal machine telemetry.
     */
    updateTelemetry(
      machine,
      INTERVAL_MS
    );

    /*
     * Keep simulator behavior consistent.
     */
    updateSeatbelt(machine);

    /*
     * Create telemetry using the same
     * function used by the live simulator.
     */
    const payload =
      createTelemetryPayload(machine);

    /*
     * Use simulated historical time.
     */
    payload.timestamp =
      new Date(
        currentTimestamp
      ).toISOString();

    /*
     * Calculate anomaly features.
     */
    const features =
      calculateFeatures(payload);

    /*
     * Add record to dataset.
     */
    rows.push(
      createCsvRow(
        payload,
        features
      )
    );

    currentTimestamp +=
      INTERVAL_MS;
  }

  return {
    rows,
    nextTimestamp:
      currentTimestamp,
  };
}


/*
 * Generate the complete timeline
 * for one machine.
 */
function generateMachineData(
  machineConfig,
  startTimestamp
) {
  const machine = createMachine({
    machineId:
      machineConfig.machineId,

    scenario:
      SCENARIOS.NORMAL,

    latitude:
      machineConfig.latitude,

    longitude:
      machineConfig.longitude,
  });

  const rows = [];

  let currentTimestamp =
    startTimestamp;

  for (
    const episode of EPISODE_TEMPLATES
  ) {
    console.log(
      `[DATASET] ${
        machine.machineId
      } | ${
        episode.scenario
      } | ${
        episode.ticks
      } ticks`
    );

    const result =
      runEpisode(
        machine,
        episode.scenario,
        episode.ticks,
        currentTimestamp
      );

    rows.push(
      ...result.rows
    );

    currentTimestamp =
      result.nextTimestamp;
  }

  return rows;
}


/*
 * Generate complete dataset.
 */
function generateDataset() {
  console.log(
    "\n========================================"
  );

  console.log(
    "   CATERPILLAR ANOMALY DATASET"
  );

  console.log(
    "========================================"
  );

  console.log(
    `Machines: ${MACHINES.length}`
  );

  console.log(
    `Episodes per machine: ${
      EPISODE_TEMPLATES.length
    }`
  );

  console.log(
    `Interval: ${INTERVAL_MS} ms`
  );

  console.log(
    "========================================\n"
  );

  /*
   * Create data directory.
   */
  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true,
    }
  );

  const rows = [
    createCsvHeader(),
  ];

  /*
   * Historical starting timestamp.
   */
  const startTimestamp =
    new Date(
      "2026-01-01T00:00:00Z"
    ).getTime();

  /*
   * Generate data for each machine.
   */
  for (
    const machine of MACHINES
  ) {
    console.log(
      `\n[DATASET] Generating ${
        machine.machineId
      }`
    );

    const machineRows =
      generateMachineData(
        machine,
        startTimestamp
      );

    rows.push(
      ...machineRows
    );

    console.log(
      `[DATASET] ${
        machine.machineId
      } complete: ${
        machineRows.length
      } records`
    );
  }

  /*
   * Write CSV.
   */
  fs.writeFileSync(
    OUTPUT_FILE,
    rows.join("\n"),
    "utf8"
  );

  console.log(
    "\n========================================"
  );

  console.log(
    "[DONE] Anomaly dataset generated"
  );

  console.log(
    `File: ${OUTPUT_FILE}`
  );

  console.log(
    `Total records: ${
      rows.length - 1
    }`
  );

  console.log(
    "========================================\n"
  );
}

generateDataset();