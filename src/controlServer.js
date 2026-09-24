const express = require("express");

const {
  config,
  VALID_WEATHER,
  VALID_VISIBILITY,
} = require("./config");

const {
  SCENARIOS,
} = require("./scenarios");

const {
  startSimulator,
  setScenario,
  stopScenario,
  getSimulatorStatus,
  getLatestTelemetry,
  getSiteConditions,
  setSiteConditions,
  soundHorn,
  hazards,
  precheck,
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
  "EXC001",
  "EXC002",
  "EXC003",
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
 * LIVE TELEMETRY + SITE CONDITIONS
 * -----------------------------------------
 */

app.get(
  "/api/telemetry",
  (req, res) => {
    res.json(getLatestTelemetry());
  }
);


app.get(
  "/api/site",
  (req, res) => {
    res.json(getSiteConditions());
  }
);


app.post(
  "/api/site",
  (req, res) => {
    const { weather, visibility, ambientTempC } = req.body;
    const next = {};

    if (weather !== undefined) {
      if (!VALID_WEATHER.includes(weather)) {
        return res.status(400).json({ error: `weather must be one of ${VALID_WEATHER.join(", ")}` });
      }
      next.weather = weather;
    }

    if (visibility !== undefined) {
      if (!VALID_VISIBILITY.includes(visibility)) {
        return res.status(400).json({ error: `visibility must be one of ${VALID_VISIBILITY.join(", ")}` });
      }
      next.visibility = visibility;
    }

    if (ambientTempC !== undefined) {
      const t = Number(ambientTempC);
      if (!Number.isFinite(t)) {
        return res.status(400).json({ error: "ambientTempC must be a number" });
      }
      next.ambientTempC = t;
    }

    res.json(setSiteConditions(next));
  }
);


/*
 * -----------------------------------------
 * HORN (machine side)
 * -----------------------------------------
 */

app.post(
  "/api/horn",
  (req, res) => {
    try {
      soundHorn();
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);


/*
 * -----------------------------------------
 * MANUAL SAFETY HAZARDS (machine side)
 * -----------------------------------------
 *
 * GET  /api/hazards                     list + which are on
 * POST /api/hazards { id, active, value } switch one on/off
 * POST /api/hazards/clear               switch all off
 * POST /api/hazards/impact { g }        one-shot collision
 */

function hazardAction(fn) {
  return (req, res) => {
    try {
      res.json(fn(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
}

app.get(
  "/api/hazards",
  (req, res) => {
    res.json(hazards.list());
  }
);

app.post("/api/hazards", hazardAction(({ id, active, value }) => hazards.set(id, active !== false, value)));

app.post("/api/hazards/clear", hazardAction(() => hazards.clearAll()));

app.post("/api/hazards/impact", hazardAction(({ g }) => hazards.impact(g === undefined ? 3.4 : Number(g))));


/*
 * -----------------------------------------
 * PRE-CHECK (machine side, human in the loop)
 * -----------------------------------------
 */

function precheckAction(fn) {
  return (req, res) => {
    try {
      res.json(fn(req.body || {}));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
}

app.get(
  "/api/precheck",
  (req, res) => {
    res.json(precheck.getPanel());
  }
);

app.post("/api/precheck/mode", precheckAction(({ mode }) => precheck.setMode(mode)));

app.post(
  "/api/precheck/verify",
  precheckAction(({ sensor, status, note }) => precheck.verify(sensor, status, note || ""))
);

app.post("/api/precheck/mark-all-ok", precheckAction(() => precheck.markAllOk()));

app.post("/api/precheck/submit", precheckAction(() => precheck.submit()));


/*
 * -----------------------------------------
 * SERVER
 * -----------------------------------------
 */

const PORT =
  config.controlPort;


const server = app.listen(
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


server.on(
  "error",
  (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `\n[CONTROL] Port ${PORT} is already in use — another simulator is probably running.\n` +
        `[CONTROL] Stop it, or start this one on another port: set CONTROL_PORT=3001\n`
      );
    } else {
      console.error("[CONTROL] Server error:", error);
    }
    process.exit(1);
  }
);