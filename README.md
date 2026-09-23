# Caterpillar Machine Simulator

Synthetic Caterpillar machine telemetry simulator for the CATman project.

The simulator generates machine telemetry and publishes it to an MQTT broker. A local web UI allows the user to select a machine and trigger different machine scenarios.

---

## Requirements

Each laptop running the simulator needs:

- Git
- Node.js 18 or later
- npm
- MQTT broker access

For the MQTT broker, this project uses **Eclipse Mosquitto**.

---

# 1. Install Git

Check whether Git is already installed:

```bash
git --version
```

If Git is not installed, install it from:

https://git-scm.com/downloads

---

# 2. Install Node.js

Check whether Node.js and npm are already installed:

```bash
node --version
npm --version
```

Node.js 18 or later is recommended.

If Node.js is not installed, download it from:

https://nodejs.org/

After installation, restart the terminal and verify:

```bash
node --version
npm --version
```

---

# 3. Clone the Repository

Clone the repository:

```bash
git clone <REPOSITORY_URL>
```

Enter the project directory:

```bash
cd caterpillar-machine-simulator
```

---

# 4. Install Project Dependencies

Install all Node.js dependencies:

```bash
npm install
```

This installs the dependencies defined in `package.json`.

---

# 5. Install the MQTT Broker

The simulator requires an MQTT broker to publish and receive machine telemetry.

This project uses **Eclipse Mosquitto**.

## Ubuntu / WSL

Update the package list:

```bash
sudo apt update
```

Install Mosquitto and the MQTT command-line clients:

```bash
sudo apt install mosquitto mosquitto-clients
```

Verify the installation:

```bash
mosquitto --version
```

You should see the installed Mosquitto version.

## Windows

Download and install Mosquitto from:

https://mosquitto.org/download/

After installation, verify it from PowerShell:

```powershell
mosquitto --version
```

---

# 6. Start the MQTT Broker

On the laptop that will host the MQTT broker, run:

```bash
mosquitto -v
```

The broker will normally listen on:

```text
localhost:1883
```

Keep this terminal running.

Do not close it while testing the simulator.

---

# 7. Test the MQTT Broker

Open another terminal on the broker laptop.

Run:

```bash
mosquitto_sub -h localhost -t "machines/+/telemetry" -v
```

This subscribes to telemetry from all machines.

The terminal will wait for messages.

Once the simulator starts publishing telemetry, messages should appear similar to:

```text
machines/EXC001/telemetry {"machineId":"EXC001", ...}
```

If messages appear, the MQTT broker is working correctly.

---

# 8. Configure the Simulator

Create a `.env` file in the project root:

```text
caterpillar-machine-simulator/
├── .env
├── package.json
├── src/
└── public/
```

Add:

```env
# Unique machine identifier
MACHINE_ID=EXC001

# MQTT broker
MQTT_BROKER_URL=mqtt://localhost:1883

# Default simulation scenario
SCENARIO=NORMAL

# Telemetry publishing interval
SIMULATOR_INTERVAL_MS=4000

# Starting machine location
MACHINE_LATITUDE=12.970000
MACHINE_LONGITUDE=79.156000
```

If the MQTT broker is running on the same laptop as the simulator, use:

```env
MQTT_BROKER_URL=mqtt://localhost:1883
```

---

# 9. Start the Simulator

Run:

```bash
npm start
```

The control server will start on:

```text
http://localhost:3000
```

Open the address in a browser:

```text
http://localhost:3000
```

---

# 10. Select a Machine

The simulator UI will first display the machine selection screen.

Select one of the available machines:

```text
EXC001
EXC002
EXC003
```

Then click:

**Start Machine**

The simulator will connect to the MQTT broker and begin publishing telemetry.

---

# 11. Test Normal Telemetry

After starting the machine, leave the scenario as:

```text
NORMAL
```

The simulator should continuously publish telemetry.

The terminal should show messages similar to:

```text
[MQTT] Connected to mqtt://localhost:1883
[MQTT] Publishing telemetry to machines/EXC001/telemetry
```

The MQTT subscriber should also receive telemetry:

```text
machines/EXC001/telemetry {...}
```

---

# 12. Test Machine Scenarios

After starting the machine, the UI provides several scenarios.

Available scenarios:

- Normal
- Seatbelt Violation
- Excessive Idle
- Overheating
- High Vibration
- Proximity Hazard
- Abnormal Fuel Consumption
- Sensor Fault (brakes and rear proximity sensor fail, so the next pre-check fails)
- Rollover Risk (tilt climbs to 19°)
- Impact (a single 3.4 g shock)
- Worker Nearby (a person 1.8 m away, which is critical)
- Operator Absent (seat and seatbelt empty while the machine is running)
- Low Oil Pressure
- Overload (6200 kg against a 5000 kg rated capacity)
- Machine Offline

The dropdown is filled from `GET /api/scenarios`, so it always matches the code.

To test a scenario:

1. Select a scenario.
2. Enter the duration in seconds.
3. Click **Start Scenario**.
4. Observe the telemetry.
5. Wait for the specified duration.
6. Verify that the simulator automatically returns to `NORMAL`.

Example:

```text
Scenario: OVERHEATING
Duration: 15 seconds
```

Click:

**Start Scenario**

The simulator will publish overheating telemetry for approximately 15 seconds and then return to:

```text
NORMAL
```

---

# 13. Test Individual Scenarios

## Overheating

Select:

```text
OVERHEATING
```

Start the scenario for 10–15 seconds.

The machine temperature should become abnormal.

---

## High Vibration

Select:

```text
HIGH_VIBRATION
```

Start the scenario.

The vibration value should increase.

---

## Seatbelt Violation

Select:

```text
SEATBELT_VIOLATION
```

During the scenario, the seatbelt status should become invalid.

After the scenario ends, it should return to normal.

---

## Excessive Idle

Select:

```text
EXCESSIVE_IDLE
```

The machine should remain in the `IDLE` state with low RPM.

---

## Abnormal Fuel Consumption

Select:

```text
ABNORMAL_FUEL_CONSUMPTION
```

Fuel consumption should become significantly higher than normal.

---

## Proximity Hazard

Select:

```text
PROXIMITY_HAZARD
```

The machine location should change to the configured proximity-hazard location.

---

## Machine Offline

Select:

```text
MACHINE_OFFLINE
```

During this scenario, the simulator stops publishing telemetry.

After the scenario duration expires, the simulator returns to `NORMAL` and telemetry resumes.

---

# 14. Return to Normal Manually

At any time, click:

**Return to Normal**

This immediately changes the simulator back to:

```text
NORMAL
```

---

# Operator dashboard integration (CATman_central)

The control page (`http://localhost:3000`) also acts as the machine side for the operator dashboard.

**Extra MQTT topics**

| Direction | Topic | What |
|---|---|---|
| out | `machines/{id}/heartbeat` | every 5 s (`HEARTBEAT_INTERVAL_MS`) |
| out | `machines/{id}/state` | on change (IDLE / OPERATING / ...) |
| out | `machines/{id}/events` | `HORN_SOUNDED`, `IMPACT`, ... |
| out | `site/conditions` | weather, visibility and ambient temperature every 60 s, and on change |
| in | `machines/{id}/commands/precheck` | run a pre-check (AUTO or MANUAL) |
| in | `machines/{id}/commands/precheck-cancel`, `/shift`, `/horn` | cancel, shift start/end, sound the horn |
| out | `machines/{id}/precheck/ack`, `/progress`, `/result` | pre-check response |

Telemetry now also includes: operator presence, hydraulic lockout, parking brake, nearest object distance, impact g, speed, tilt, swing angle, boom height, load and rated capacity, oil pressure, terrain and sensor faults.

**Pre-check panel** (on the control page)

- **AUTO**: the machine checks its 15 sensors itself and reports the result in about 3 s.
- **MANUAL** (human in the loop): when the operator starts a pre-check, the panel lists all 15 sensors with their live readings. Mark each one **OK / WARN / FAIL**, with an optional note. Each one shows up on the operator's dashboard straight away. **Mark all OK** marks everything OK, and **Submit** is enabled once all 15 are marked.

**Other controls**: site weather and visibility (these change the size of the dashboard's safety zone) and a **Horn** button.

**Control API**: `GET /api/telemetry`, `GET/POST /api/site`, `POST /api/horn`, `GET /api/precheck`, `POST /api/precheck/mode | verify | mark-all-ok | submit`.

---

# 15. Multiple Laptop Setup

For the hackathon, multiple laptops can run the simulator simultaneously.

Recommended setup:

```text
                    Local Network / Hotspot
                             |
              +--------------+--------------+
              |              |              |
          Laptop 1       Laptop 2       Laptop 3
        EXC001    EXC002    EXC003
              |              |              |
              +--------------+--------------+
                             |
                       MQTT Broker
                         Port 1883
```

One laptop should act as the MQTT broker.

All other laptops connect to that broker.

---

# 16. Find the MQTT Broker Laptop IP

The broker laptop must be reachable by the other laptops over the same local network.

## Linux / WSL

Run:

```bash
hostname -I
```

Example:

```text
192.168.1.100
```

## Windows

Run:

```powershell
ipconfig
```

Look for the IPv4 address of the active network adapter.

Example:

```text
IPv4 Address: 192.168.1.100
```

---

# 17. Configure Other Laptops

Suppose the MQTT broker is running on:

```text
192.168.1.100
```

On Laptop 1, Laptop 2, and Laptop 3, configure:

```env
MQTT_BROKER_URL=mqtt://192.168.1.100:1883
```

Do NOT use:

```env
MQTT_BROKER_URL=mqtt://localhost:1883
```

on laptops where the broker is running on another machine.

`localhost` always refers to the current laptop.

---

# 18. Assign Different Machines

Each laptop should select a different machine through the UI.

Example:

```text
Laptop 1 → EXC001
Laptop 2 → EXC002
Laptop 3 → EXC003
```

All three simulators publish to the same MQTT broker.

The telemetry topics are machine-specific:

```text
machines/EXC001/telemetry
machines/EXC002/telemetry
machines/EXC003/telemetry
```

The operator backend can subscribe to all machines using:

```text
machines/+/telemetry
```

---

# 19. Recommended Hackathon Network

For a reliable offline demo, use a local network or mobile hotspot instead of depending on campus internet.

Example:

```text
                    Mobile Hotspot
                         |
          +--------------+--------------+
          |              |              |
       Laptop 1       Laptop 2       Laptop 3
       Simulator      Simulator      Simulator
          |              |              |
          +--------------+--------------+
                         |
                   MQTT Broker
```

The important requirement is that all laptops can communicate with the MQTT broker's IP address.

---

# 20. Generate the Dataset

The project also contains synthetic dataset generation.

To generate the datasets, run:

```bash
npm run generate-dataset
```

Generated datasets are stored in the `data/` directory.

---

# 21. Stop the Simulator

To stop the simulator:

```text
Ctrl + C
```

---

# 22. Stop the MQTT Broker

On the terminal running Mosquitto:

```text
Ctrl + C
```

---

# 23. Troubleshooting

## MQTT connection fails

Check that the broker is running:

```bash
mosquitto -v
```

Check the `.env` configuration:

```env
MQTT_BROKER_URL=mqtt://<BROKER_IP>:1883
```

If the broker is on another laptop, make sure both laptops are connected to the same network.

---

## `localhost:1883` does not work from another laptop

This is expected.

`localhost` refers to the current laptop.

Use the MQTT broker laptop's LAN IP instead:

```env
MQTT_BROKER_URL=mqtt://192.168.x.x:1883
```

---

## Port 3000 is already in use

Another application, or an older simulator, may already be using port 3000.

Stop it and run the simulator again, or start this one on another port:
`CONTROL_PORT=3001 npm start` (PowerShell: `$env:CONTROL_PORT=3001; npm start`).

---

## `npm start` fails

Make sure dependencies are installed:

```bash
npm install
```

Then try:

```bash
npm start
```

---

## UI does not open

Make sure the simulator is running:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

---

## No MQTT messages appear

Start a subscriber on the broker laptop:

```bash
mosquitto_sub -h localhost -t "machines/+/telemetry" -v
```

Then start the simulator.

If the simulator is connected correctly, telemetry messages should appear.

---

# Quick Start

For a single laptop where the MQTT broker is also running locally:

### Terminal 1 — Start MQTT Broker

```bash
mosquitto -v
```

### Terminal 2 — Setup and Start Simulator

```bash
git clone <REPOSITORY_URL>
cd caterpillar-machine-simulator
npm install
```

Create `.env`:

```env
MACHINE_ID=EXC001
MQTT_BROKER_URL=mqtt://localhost:1883
SCENARIO=NORMAL
SIMULATOR_INTERVAL_MS=4000
MACHINE_LATITUDE=12.970000
MACHINE_LONGITUDE=79.156000
```

Start:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Select a machine, click **Start Machine**, and test the scenarios.

---

# Quick Start — Three Laptop Setup

### Laptop 1 — MQTT Broker

Start Mosquitto:

```bash
mosquitto -v
```

Find its LAN IP:

```bash
hostname -I
```

or on Windows:

```powershell
ipconfig
```

Example broker IP:

```text
192.168.1.100
```

### Laptop 2 / 3 — Simulator

Clone and install:

```bash
git clone <REPOSITORY_URL>
cd caterpillar-machine-simulator
npm install
```

Configure `.env`:

```env
MACHINE_ID=EXC001
MQTT_BROKER_URL=mqtt://192.168.1.100:1883
SCENARIO=NORMAL
SIMULATOR_INTERVAL_MS=4000
MACHINE_LATITUDE=12.970000
MACHINE_LONGITUDE=79.156000
```

Start:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Select a different machine on each laptop.

All machines will publish telemetry through the same MQTT broker.