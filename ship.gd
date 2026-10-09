extends CharacterBody3D

## High Octane 0G - Gliding Ship Movement & Camera Tracking Controller
## Godot 4.x Compatible (CharacterBody3D Arcade Hover-Racer Physics)

signal heat_changed(current_heat: float, is_overheated: bool)

@export_group("Hover Lift & Suspension")
@export var idle_hover_height: float = 2.00
@export var cruise_hover_height: float = 0.90
@export var hover_transition_speed: float = 4.0
@export var idle_bob_amount: float = 0.080
@export var idle_bob_speed: float = 2.0
@export var hover_force: float = 48.0
@export var hover_damping: float = 6.5

@export_group("Thrusters & Speed")
@export var max_speed: float = 70.0
@export var acceleration: float = 48.0
@export var reverse_brake_force: float = 35.0
@export var drag: float = 0.988
@export var boost_multiplier: float = 1.55
@export var boost_acceleration: float = 85.0

@export_group("Nitro Overheat System")
@export var boost_heat_rate: float = 18.0
@export var cool_rate: float = 9.0
@export var cooldown_delay: float = 0.40
@export var overheat_threshold: float = 100.0
@export var recover_threshold: float = 40.0

@export_group("Steering & Aerodynamics")
@export var steering_speed: float = 2.60
@export var lateral_grip: float = 0.86 # 0.0 = pure ice drift, 1.0 = locked rails
@export var max_roll_angle: float = 30.0 # degrees of visual banking roll
@export var roll_speed: float = 7.0
@export var pitch_tilt_angle: float = 10.0 # degrees of nose pitch tilt

@export_group("Camera Settings")
@export var base_fov: float = 75.0
@export var max_fov_boost: float = 16.0
@export var camera_lerp_weight: float = 8.0

# Node references
@onready var raycast: RayCast3D = $RayCast3D
@onready var mesh: MeshInstance3D = $MeshInstance3D
@onready var camera: Camera3D = $Camera3D

# Internal velocity & rotation state
var current_turn_input: float = 0.0
var current_roll: float = 0.0
var current_pitch: float = 0.0
var is_grounded: bool = false

# Hover lift state
var current_speed_ratio: float = 0.0
var current_boost_ratio: float = 0.0
var bob_time: float = 0.0
var effective_hover_height: float = 2.00

# Nitro Overheat state
var heat: float = 0.0
var is_overheated: bool = false
var time_since_boost: float = 0.0

func _ready() -> void:
	if camera:
		camera.fov = base_fov
	if raycast:
		raycast.target_position = Vector3(0, -4.0, 0)
	heat_changed.emit(heat, is_overheated)

func _physics_process(delta: float) -> void:
	# 1. Gather player input (WASD / Arrows / Gamepad)
	var throttle := Input.get_axis("ui_down", "ui_up") # -1.0 reverse/brake, +1.0 forward
	var steer := Input.get_axis("ui_right", "ui_left")  # +1.0 turn left, -1.0 turn right
	var raw_boost_input := Input.is_action_pressed("boost") or Input.is_key_pressed(KEY_SHIFT)

	# 2. Nitro Overheat System Logic
	# Boost only functions if boost key is pressed, throttle is forward, and engine is NOT overheated
	var is_boosting := raw_boost_input and throttle > 0.0 and not is_overheated

	if is_boosting:
		time_since_boost = 0.0
		heat = min(overheat_threshold, heat + boost_heat_rate * delta)
		if heat >= overheat_threshold:
			is_overheated = true
	else:
		time_since_boost += delta
		if time_since_boost >= cooldown_delay:
			heat = max(0.0, heat - cool_rate * delta)
			if is_overheated and heat <= recover_threshold:
				is_overheated = false

	heat_changed.emit(heat, is_overheated)

	# 3. Hover Lift Effect Calculation
	var horizontal_speed := Vector2(velocity.x, velocity.z).length()
	var target_speed_ratio := clamp(horizontal_speed / max_speed, 0.0, 1.0)
	
	# Smooth speed ratio so transition has aerodynamic inertia
	current_speed_ratio = lerp(current_speed_ratio, target_speed_ratio, clamp(hover_transition_speed * delta, 0.0, 1.0))
	
	# Boost drops hover height slightly lower
	var target_boost := 1.0 if is_boosting else 0.0
	current_boost_ratio = lerp(current_boost_ratio, target_boost, clamp(hover_transition_speed * delta, 0.0, 1.0))
	var boost_drop := current_boost_ratio * 0.15

	# Gentle idle bobbing sine wave when slowed or stopped (fades out at speed)
	bob_time += delta * idle_bob_speed
	var bob_factor := 1.0 - clamp(current_speed_ratio, 0.0, 1.0)
	var bob_offset := sin(bob_time * TAU) * idle_bob_amount * bob_factor

	# Target hover height smoothly transitions from idle (high) to cruise (low)
	var base_target_height := lerp(idle_hover_height, cruise_hover_height, current_speed_ratio)
	effective_hover_height = max(0.4, base_target_height - boost_drop + bob_offset)

	# 4. Hover Suspension: RayCast3D detection to track plane
	if raycast and raycast.is_colliding():
		is_grounded = true
		var hit_point = raycast.get_collision_point()
		var distance = global_position.distance_to(hit_point)
		var compression = effective_hover_height - distance
		
		# Spring force: F = k * x - c * v
		var spring_force = compression * hover_force
		var damping_force = velocity.y * hover_damping
		velocity.y += (spring_force - damping_force) * delta
	else:
		is_grounded = false
		# Apply gravity when airborne or over jumps
		velocity += get_gravity() * delta

	# 5. Steering & Yaw Rotation
	if is_grounded or velocity.length() > 3.0:
		current_turn_input = lerp(current_turn_input, steer * steering_speed, 10.0 * delta)
		rotate_y(current_turn_input * delta)

	# 6. Forward Thrusters & Air Braking
	var forward_dir := -transform.basis.z.normalized()
	var right_dir := transform.basis.x.normalized()
	
	var active_accel = boost_acceleration if is_boosting else acceleration
	var active_top_speed = (max_speed * boost_multiplier) if is_boosting else max_speed

	var forward_speed = velocity.dot(forward_dir)

	if throttle > 0.0:
		if forward_speed < active_top_speed:
			velocity += forward_dir * (active_accel * throttle * delta)
	elif throttle < 0.0:
		velocity -= forward_dir * (reverse_brake_force * abs(throttle) * delta)

	# 7. Gliding Aerodynamics: Decoupled forward & lateral drift velocities
	var forward_vel = forward_dir * velocity.dot(forward_dir)
	var lateral_vel = right_dir * velocity.dot(right_dir)
	var vertical_vel = Vector3(0, velocity.y, 0)

	# Lateral friction dampens sideways sliding according to grip factor
	lateral_vel = lateral_vel * pow(1.0 - (1.0 - lateral_grip), delta * 60.0)
	
	# Aerodynamic forward air drag
	forward_vel *= pow(drag, delta * 60.0)

	velocity = forward_vel + lateral_vel + vertical_vel

	# 8. Apply Movement in Godot 4
	move_and_slide()

	# 9. Visual Roll Banking & Pitch Tilt
	var target_roll = -steer * deg_to_rad(max_roll_angle)
	var target_pitch = throttle * deg_to_rad(pitch_tilt_angle)
	current_roll = lerp(current_roll, target_roll, roll_speed * delta)
	current_pitch = lerp(current_pitch, target_pitch, roll_speed * delta)

	if mesh:
		mesh.rotation.z = current_roll
		mesh.rotation.x = -current_pitch

	# 10. Dynamic Camera Tracking (Speed FOV expansion)
	if camera:
		var speed_ratio = clamp(velocity.length() / max_speed, 0.0, 1.8)
		var target_fov = base_fov + (speed_ratio * max_fov_boost)
		camera.fov = lerp(camera.fov, target_fov, camera_lerp_weight * delta)
