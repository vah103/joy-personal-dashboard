# TurtleBot4 Stage 4 — Simulation validation

## Scope

This document defines the repeatable Stage 4 simulation scenarios and the simulation-to-real parity boundary for ROS 2 Jazzy, Gazebo Sim 8 and `nav2_minimal_tb4_sim`.

A scenario is **passed only after its command output and visual observations are preserved as evidence**. Writing this procedure does not by itself prove robot motion, recovery behavior or warehouse-world behavior.

## Common setup

Run the simulator in terminal 1:

```bash
source /opt/ros/jazzy/setup.bash
ros2 launch nav2_minimal_tb4_sim simulation.launch.py
```

The default world is:

```text
/opt/ros/jazzy/share/nav2_minimal_tb4_sim/worlds/depot.sdf
```

For the warehouse world, replace the launch command with:

```bash
ros2 launch nav2_minimal_tb4_sim simulation.launch.py \
  world:=/opt/ros/jazzy/share/nav2_minimal_tb4_sim/worlds/warehouse.sdf
```

## Evidence directory

Create one directory per run. Do not overwrite an earlier run.

```bash
RUN_ID="$(date +%Y%m%d-%H%M%S)"
EVIDENCE="$HOME/turtlebot4_project/evidence/stage4_sim/$RUN_ID"
mkdir -p "$EVIDENCE"
printf '%s\n' "$EVIDENCE"
```

Save terminal output with `tee` where practical and add screenshots of Gazebo and RViz to the same directory.

## S4-A — Baseline bring-up

### Purpose

Verify that the controlled world, TurtleBot4 model and required ROS interfaces start together.

### Checks

```bash
ros2 node list | sort | tee "$EVIDENCE/nodes.txt"
ros2 topic list -t | sort | tee "$EVIDENCE/topics.txt"
timeout 8 ros2 topic hz /clock | tee "$EVIDENCE/clock_hz.txt"
ros2 topic echo /scan --once | tee "$EVIDENCE/scan_once.txt"
ros2 topic echo /odom --once | tee "$EVIDENCE/odom_once.txt"
ros2 topic echo /rgbd_camera/camera_info --once | tee "$EVIDENCE/camera_info_once.txt"
timeout 8 ros2 topic hz /rgbd_camera/image | tee "$EVIDENCE/rgb_hz.txt"
timeout 8 ros2 topic hz /rgbd_camera/depth_image | tee "$EVIDENCE/depth_hz.txt"
```

### Pass signal

- `/clock` advances.
- `/scan` has frame `rplidar_link` and non-empty ranges.
- `/odom` has `odom` → `base_link` data.
- RGB and depth image topics publish repeatedly.
- RViz shows the robot model and TF without a global error.

### Current evidence

Passed in Joy work session `session-tb4-read-joy-repo-20260803` for the depot world. This evidence is simulation-only.

## S4-B — Controlled motion and sensor continuity

### Purpose

Verify command flow, odometry change, TF continuity and sensor continuity while the simulated robot moves.

### Safety and rollback

This command targets the simulator's root `/cmd_vel`, not `/bot1/cmd_vel` on the physical robot. Keep the real robot disconnected from the ROS domain during this home test. Stop motion with `Ctrl+C`; the timeout also stops publication automatically.

### Procedure

Capture the initial pose:

```bash
ros2 topic echo /odom --once | tee "$EVIDENCE/odom_before.txt"
```

Drive forward slowly for 5 seconds:

```bash
timeout 5 ros2 topic pub -r 10 /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.20}, angular: {z: 0.0}}" \
  | tee "$EVIDENCE/cmd_forward.txt"
```

Stop explicitly:

```bash
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist \
  "{linear: {x: 0.0}, angular: {z: 0.0}}"
```

Capture the final pose and sensor rates:

```bash
ros2 topic echo /odom --once | tee "$EVIDENCE/odom_after.txt"
timeout 8 ros2 topic hz /scan | tee "$EVIDENCE/scan_motion_hz.txt"
timeout 8 ros2 topic hz /tf | tee "$EVIDENCE/tf_motion_hz.txt"
```

### Pass signal

- The robot visibly moves forward and stops.
- Position in `odom_after.txt` differs from `odom_before.txt` by a plausible amount.
- `/scan` and `/tf` continue publishing without a sustained interruption.
- No fatal bridge or simulator error appears.

## S4-C — World parity run

### Purpose

Repeat baseline bring-up and controlled motion in `warehouse.sdf` to ensure the stack is not coupled only to the default depot world.

### Procedure

1. Stop the depot launch cleanly with `Ctrl+C`.
2. Launch `warehouse.sdf` using the command in Common setup.
3. Create a new evidence directory.
4. Repeat S4-A and S4-B.

### Pass signal

The robot spawns, required topics publish, controlled motion changes odometry and sensors remain continuous in the warehouse world.

## S4-D — Restart recovery

### Purpose

Verify that a clean simulator restart restores the ROS graph without manual configuration edits.

### Procedure

1. While the simulator is healthy, save `ros2 node list` and `ros2 topic list -t`.
2. Stop the top-level launch with `Ctrl+C`.
3. Confirm simulation nodes and sensor topics disappear.
4. Start the same launch command again.
5. Repeat the S4-A checks into a new evidence directory.

### Pass signal

The second launch restores `/clock`, `/scan`, `/odom`, `/tf`, RGB and depth streams, and RViz robot state without changing installed packages or configuration.

## Simulation-to-real parity matrix

| Area | Gazebo simulation | Physical TurtleBot4 | Validation boundary |
|---|---|---|---|
| Time | Uses simulated `/clock`; nodes require `use_sim_time=true` | Uses wall/ROS time; no Gazebo clock | Never infer real timing or latency from simulation clock rate |
| Namespace | Current minimal simulation uses root topics such as `/scan`, `/odom`, `/cmd_vel` | Verified lab robot uses `/bot1/...` | Launch files, remaps and scripts must make the namespace explicit |
| LiDAR | Gazebo ray sensor, frame `rplidar_link`, idealized geometry/noise | Physical RPLIDAR, observed around 7.58 Hz and may require motor recovery | Recheck rate, QoS, occlusion and motor state on the robot |
| RGB-D | Simulated 320×240 RGB/depth streams around 6–8 Hz | OAK-D Pro RGB/RGB-D, previously observed near 30/28.7 Hz with USB and pipeline constraints | Recheck resolution, encoding, calibration, synchronization and latency |
| Odometry | Generated by simulated drive dynamics | Create 3 wheel odometry with slip, calibration and floor effects | Simulation pose accuracy does not prove physical odometry accuracy |
| TF | Generated from model and simulation plugins | Depends on robot bringup, namespaces and sensor mounts | Compare exact frame names and timestamp continuity before reuse |
| Dynamics | Deterministic/idealized mass, friction and collision parameters | Battery, wheel slip, caster behavior and payload affect motion | Retune speeds, acceleration and controller tolerances on hardware |
| Network | Local ROS graph with no Wi-Fi transport uncertainty | Lab Wi-Fi/SSH/DDS discovery can add loss and delay | Repeat QoS, discovery and latency checks in the lab |
| Obstacles | SDF geometry is known and static unless scripted | People, furniture and reflective surfaces are variable | Physical safety tests require an operator and clear stop procedure |
| Recovery | Process restart and simulated collision recovery | Hardware/service restart can affect Create 3, LiDAR and OAK-D | Do not copy restart commands to hardware without impact and rollback review |

## Stage 4 acceptance rule

Stage 4 can be marked complete only when:

- S4-A has preserved evidence.
- S4-B has preserved motion evidence.
- S4-C has preserved warehouse-world evidence.
- S4-D has preserved restart-recovery evidence.
- The parity matrix is retained with the project documentation.

Passing Stage 4 proves the simulation baseline only. It does not prove SLAM, autonomous exploration, Nav2 behavior or physical-robot behavior.
