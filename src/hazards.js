/*
 * -----------------------------------------
 * MANUAL SAFETY HAZARDS (machine side)
 * -----------------------------------------
 *
 * Toggles set from the control page that stay
 * on until switched off (unlike scenarios, which
 * run for a fixed duration). They are applied to
 * a copy of the machine just before publishing,
 * so they override what the sensors report (and
 * win over any running scenario) without changing
 * the simulated machine itself.
 *
 * The values are what the physical sensors would
 * read. Detection happens only in CATman_central.
 */

const HAZARDS = {
  SEATBELT_OFF: {
    label: "Seatbelt unfastened",
    description: "Seatbelt sensor reads OPEN. Alerts once the machine is working for 5 s.",
    apply: (m) => {
      m.seatbeltStatus = false;
    },
  },
  OPERATOR_OUT: {
    label: "Operator left the seat",
    description: "Seat empty, belt open, hydraulics unlocked, engine running.",
    apply: (m) => {
      m.operatorPresent = false;
      m.seatbeltStatus = false;
      m.hydraulicLockout = false;
    },
  },
  WORKER_NEAR: {
    label: "Worker near the machine",
    description: "Proximity sensor distance to the nearest person.",
    value: { name: "Distance", unit: "m", default: 1.8, min: 0.3, max: 30, step: 0.1 },
    apply: (m, v) => {
      m.nearestObjectDistanceM = v;
    },
  },
  TILT: {
    label: "Tilt / rollover risk",
    description: "Machine tilt angle (limit 15°, 10° when loaded with the boom up).",
    value: { name: "Tilt", unit: "°", default: 19, min: 0, max: 35, step: 0.5 },
    apply: (m, v) => {
      m.tiltAngleDeg = v;
    },
  },
  OVERLOAD: {
    label: "Overloaded bucket",
    description: "Load weight (rated capacity 5000 kg).",
    value: { name: "Load", unit: "kg", default: 6200, min: 0, max: 9000, step: 100 },
    apply: (m, v) => {
      m.loadWeightKg = v;
    },
  },
  OVERHEAT: {
    label: "Engine overheating",
    description: "Engine and hydraulic temperature.",
    value: { name: "Engine", unit: "°C", default: 110, min: 60, max: 130, step: 1 },
    apply: (m, v) => {
      m.engineTemperature = v;
      m.hydraulicTemperature = Math.max(m.hydraulicTemperature, v - 12);
    },
  },
  LOW_OIL: {
    label: "Low oil pressure",
    description: "Oil pressure (alerts below 150 kPa above 800 rpm).",
    value: { name: "Oil", unit: "kPa", default: 110, min: 0, max: 400, step: 5 },
    apply: (m, v) => {
      m.oilPressureKpa = v;
      m.engineRpm = Math.max(m.engineRpm, 1200);
    },
  },
  HIGH_VIBRATION: {
    label: "High vibration",
    description: "Vibration (alerts above 0.8 g).",
    value: { name: "Vibration", unit: "g", default: 1.3, min: 0, max: 3, step: 0.05 },
    apply: (m, v) => {
      m.vibration = v;
    },
  },
};

// Toggling seatbelt/operator hazards while the machine is idle would not
// alert (the rules only care while working), so these also keep it working.
const KEEPS_WORKING = new Set(["SEATBELT_OFF", "OPERATOR_OUT", "LOW_OIL"]);
const WORKING_STATES = new Set(["OPERATING", "LOADING", "UNLOADING", "TRANSPORTING"]);

function createHazardController() {
  const active = {}; // id -> { value, since }

  function list() {
    return Object.entries(HAZARDS).map(([id, h]) => ({
      id,
      label: h.label,
      description: h.description,
      value: h.value || null,
      active: !!active[id],
      currentValue: active[id] ? active[id].value : h.value ? h.value.default : null,
      since: active[id] ? active[id].since : null,
    }));
  }

  function set(id, on, value) {
    const hazard = HAZARDS[id];
    if (!hazard) {
      throw new Error(`Unknown hazard ${id}. Valid: ${Object.keys(HAZARDS).join(", ")}`);
    }

    if (!on) {
      delete active[id];
      return list();
    }

    let v = null;
    if (hazard.value) {
      v = value === undefined || value === null || value === "" ? hazard.value.default : Number(value);
      if (!Number.isFinite(v) || v < hazard.value.min || v > hazard.value.max) {
        throw new Error(`${hazard.value.name} must be between ${hazard.value.min} and ${hazard.value.max} ${hazard.value.unit}`);
      }
    }

    active[id] = { value: v, since: active[id] ? active[id].since : new Date().toISOString() };
    return list();
  }

  function clearAll() {
    Object.keys(active).forEach((id) => delete active[id]);
    return list();
  }

  function anyActive() {
    return Object.keys(active).length > 0;
  }

  function needsWork() {
    return Object.keys(active).some((id) => KEEPS_WORKING.has(id));
  }

  // Applied to a copy of the machine right before each publish.
  function apply(machine) {
    Object.entries(active).forEach(([id, { value }]) => HAZARDS[id].apply(machine, value));
  }

  return { list, set, clearAll, anyActive, needsWork, apply };
}

module.exports = { HAZARDS, WORKING_STATES, createHazardController };
