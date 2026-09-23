/*
 * Handles commands from the operator side
 * (machines/{id}/commands/#) and runs the
 * machine-side pre-check, either automatically or
 * with a person verifying each sensor (MANUAL).
 *
 * Replies:
 *   machines/{id}/precheck/ack       { requestId, mode }
 *   machines/{id}/precheck/progress  { requestId, index, total, sensor }
 *   machines/{id}/precheck/result    { requestId, mode, verifiedBy, overall, sensors }
 */

const { gradeAll, overallOf, SENSORS } = require("./sensors");

const AUTO_STEP_MS = 180;
const MODES = ["AUTO", "MANUAL"];
const VERIFY_STATUSES = ["OK", "WARN", "FAIL"];

function createCommandHandler({ getMachine, isOffline, publish, publishEvent }) {
  let mode = "AUTO";
  let pending = null;
  let autoTimers = [];

  function topic(suffix) {
    return `machines/${getMachine().machineId}/${suffix}`;
  }

  function clearAutoTimers() {
    autoTimers.forEach(clearTimeout);
    autoTimers = [];
  }

  function publishResult(request, sensors, verifiedBy) {
    const machine = getMachine();
    publish(topic("precheck/result"), {
      requestId: request.requestId,
      machineId: machine.machineId,
      operatorId: request.operatorId,
      timestamp: new Date().toISOString(),
      mode: request.mode,
      verifiedBy,
      overall: overallOf(sensors),
      sensors,
    });
  }

  function runAuto(request) {
    const sensors = gradeAll(getMachine()).map((s) => ({ ...s, verifiedBy: "AUTO" }));

    sensors.forEach((sensor, i) => {
      autoTimers.push(
        setTimeout(() => {
          publish(topic("precheck/progress"), {
            requestId: request.requestId,
            index: i + 1,
            total: sensors.length,
            sensor,
          });
        }, (i + 1) * AUTO_STEP_MS)
      );
    });

    autoTimers.push(
      setTimeout(() => {
        publishResult(request, sensors, "AUTO");
        if (pending?.requestId === request.requestId) pending = null;
      }, (sensors.length + 1) * AUTO_STEP_MS)
    );
  }

  function onPrecheck(payload) {
    if (isOffline()) return;
    clearAutoTimers();

    const request = {
      requestId: payload.requestId,
      operatorId: payload.operatorId || null,
      requestedAt: new Date().toISOString(),
      mode,
    };

    publish(topic("precheck/ack"), { requestId: request.requestId, mode });
    console.log(`[PRECHECK] Request ${request.requestId} from ${request.operatorId} (${mode})`);

    if (mode === "AUTO") {
      pending = { ...request, verifications: {} };
      runAuto(request);
      return;
    }

    pending = { ...request, verifications: {} };
  }

  function onPrecheckCancel(payload) {
    if (pending && pending.requestId === payload.requestId) {
      clearAutoTimers();
      console.log(`[PRECHECK] Request ${pending.requestId} cancelled by operator side`);
      pending = null;
    }
  }

  function onShift(payload) {
    const machine = getMachine();
    machine.operatorId = payload.action === "START" ? payload.operatorId || null : null;
    console.log(`[SHIFT] ${payload.action} operator=${payload.operatorId}`);
  }

  function soundHorn(source) {
    const machine = getMachine();
    machine.hornUntil = Date.now() + 1000;
    publishEvent("HORN", "INFO", { source });
    console.log(`[HORN] Sounded (${source})`);
  }

  function handle(commandTopic, payload) {
    const command = commandTopic.split("/").pop();
    switch (command) {
      case "precheck":
        return onPrecheck(payload);
      case "precheck-cancel":
        return onPrecheckCancel(payload);
      case "shift":
        return onShift(payload);
      case "horn":
        return soundHorn("OPERATOR_DASHBOARD");
      default:
        console.log(`[COMMAND] Unknown command: ${command}`);
        return undefined;
    }
  }

  // ---------- Machine-side manual verification (control UI) ----------

  function getPanel() {
    const machine = getMachine();
    if (!pending || pending.mode !== "MANUAL") {
      return { mode, pending: null };
    }

    const autoReadings = gradeAll(machine);
    const sensors = autoReadings.map((auto) => {
      const v = pending.verifications[auto.sensor];
      return {
        ...auto,
        autoStatus: auto.status,
        verified: !!v,
        status: v ? v.status : null,
        note: v ? v.note : "",
        override: v ? v.status !== auto.status : false,
      };
    });

    return {
      mode,
      pending: {
        requestId: pending.requestId,
        operatorId: pending.operatorId,
        requestedAt: pending.requestedAt,
        verifiedCount: Object.keys(pending.verifications).length,
        total: SENSORS.length,
        sensors,
      },
    };
  }

  function setMode(nextMode) {
    if (!MODES.includes(nextMode)) throw new Error(`Mode must be one of ${MODES.join(", ")}`);
    mode = nextMode;
    return getPanel();
  }

  function requireManualPending() {
    if (!pending || pending.mode !== "MANUAL") {
      throw new Error("No manual pre-check is waiting");
    }
  }

  function verify(sensorId, status, note = "") {
    requireManualPending();
    if (!VERIFY_STATUSES.includes(status)) throw new Error(`Status must be one of ${VERIFY_STATUSES.join(", ")}`);

    const auto = gradeAll(getMachine()).find((s) => s.sensor === sensorId);
    if (!auto) throw new Error(`Unknown sensor ${sensorId}`);

    pending.verifications[sensorId] = { status, note: note.trim() };
    const sensor = {
      ...auto,
      status,
      message: note.trim() || auto.message,
      autoStatus: auto.status,
      override: status !== auto.status,
      verifiedBy: "MACHINE_SIDE_MANUAL",
      note: note.trim(),
    };

    publish(topic("precheck/progress"), {
      requestId: pending.requestId,
      index: Object.keys(pending.verifications).length,
      total: SENSORS.length,
      sensor,
    });

    return getPanel();
  }

  function markAllOk() {
    requireManualPending();
    gradeAll(getMachine())
      .filter((s) => s.status === "OK" && !pending.verifications[s.sensor])
      .forEach((s) => verify(s.sensor, "OK"));
    return getPanel();
  }

  function submit() {
    requireManualPending();
    const panel = getPanel().pending;
    if (panel.verifiedCount < panel.total) {
      throw new Error(`Verify all sensors first (${panel.verifiedCount}/${panel.total})`);
    }

    const sensors = panel.sensors.map(({ verified, ...s }) => ({
      ...s,
      message: s.note || s.message,
      verifiedBy: "MACHINE_SIDE_MANUAL",
    }));
    publishResult(pending, sensors, "MACHINE_SIDE_MANUAL");
    console.log(`[PRECHECK] Manual result submitted for ${pending.requestId}`);
    pending = null;
    return getPanel();
  }

  return {
    handle,
    getPanel,
    setMode,
    verify,
    markAllOk,
    submit,
    soundHorn,
  };
}

module.exports = { createCommandHandler };
