const express = require("express");

const {
  config,
} = require("./config");

const {
  SCENARIOS,
} = require("./scenarios");

const {
  startSimulator,
  setScenario,
  stopScenario,
  getSimulatorStatus,
} = require("./machineSimulator");


/*
 * -----------------------------------------
 * EXPRESS
 * -----------------------------------------
 */

const app =
  express();


app.use(
  express.json()
);


app.use(
  express.static("public")
);


/*
 * -----------------------------------------
 * MACHINE SELECTION
 * -----------------------------------------
 *
 * The UI selects one of the three machines
 * before starting the simulator.
 * -----------------------------------------
 */

const AVAILABLE_MACHINES = [
  "MACHINE-001",
  "MACHINE-002",
  "MACHINE-003",
];


/*
 * -----------------------------------------
 * START MACHINE
 * -----------------------------------------
 */

app.post(
  "/api/machine/start",
  (req, res) => {

    const {
      machineId,
    } = req.body;


    /*
     * Validate machine ID.
     */

    if (
      !AVAILABLE_MACHINES
        .includes(machineId)
    ) {

      return res.status(400).json({

        error:
          "Invalid machine ID",

        availableMachines:
          AVAILABLE_MACHINES,

      });

    }


    /*
     * Make sure the simulator isn't
     * already running.
     */

    const currentStatus =
      getSimulatorStatus();


    if (currentStatus.started) {

      return res.status(400).json({

        error:
          "Simulator is already running",

        machineId:
          currentStatus.machineId,

      });

    }


    try {

      startSimulator(
        machineId
      );


      res.json({

        success: true,

        machineId,

        scenario:
          SCENARIOS.NORMAL,

      });

    } catch (error) {

      console.error(
        "[CONTROL] Failed to start simulator:",
        error
      );


      res.status(500).json({

        error:
          "Failed to start simulator",

      });

    }

  }
);


/*
 * -----------------------------------------
 * START SCENARIO
 * -----------------------------------------
 */

app.post(
  "/api/scenario/start",
  (req, res) => {

    const {
      scenario,
      duration,
    } = req.body;


    /*
     * Make sure a machine has been
     * selected and started.
     */

    const status =
      getSimulatorStatus();


    if (!status.started) {

      return res.status(400).json({

        error:
          "Start a machine before starting a scenario",

      });

    }


    /*
     * Validate scenario.
     */

    if (!scenario) {

      return res.status(400).json({

        error:
          "Scenario is required",

      });

    }


    if (
      !Object.values(
        SCENARIOS
      ).includes(
        scenario
      )
    ) {

      return res.status(400).json({

        error:
          `Invalid scenario: ${scenario}`,

      });

    }


    /*
     * Validate duration.
     */

    const durationSeconds =
      Number(duration);


    if (
      !Number.isFinite(
        durationSeconds
      ) ||
      durationSeconds <= 0
    ) {

      return res.status(400).json({

        error:
          "Duration must be a positive number",

      });

    }


    /*
     * Apply scenario.
     */

    setScenario(
      scenario,
      durationSeconds
    );


    res.json({

      success: true,

      machineId:
        status.machineId,

      scenario,

      duration:
        durationSeconds,

    });

  }
);


/*
 * -----------------------------------------
 * STOP SCENARIO
 * -----------------------------------------
 */

app.post(
  "/api/scenario/stop",
  (req, res) => {

    const status =
      getSimulatorStatus();


    if (!status.started) {

      return res.status(400).json({

        error:
          "No machine is running",

      });

    }


    stopScenario();


    res.json({

      success: true,

      machineId:
        status.machineId,

      scenario:
        SCENARIOS.NORMAL,

    });

  }
);


/*
 * -----------------------------------------
 * GET STATUS
 * -----------------------------------------
 */

app.get(
  "/api/status",
  (req, res) => {

    res.json(
      getSimulatorStatus()
    );

  }
);


/*
 * -----------------------------------------
 * GET SCENARIOS
 * -----------------------------------------
 */

app.get(
  "/api/scenarios",
  (req, res) => {

    res.json(
      Object.values(
        SCENARIOS
      )
    );

  }
);


/*
 * -----------------------------------------
 * SERVER
 * -----------------------------------------
 */

const PORT =
  config.controlPort || 3000;


app.listen(
  PORT,
  () => {

    console.log(
      "\n========================================"
    );

    console.log(
      "     CATERPILLAR CONTROL SERVER"
    );

    console.log(
      "========================================"
    );

    console.log(
      `Control UI: http://localhost:${PORT}`
    );

    console.log(
      "========================================\n"
    );

  }
);