"""
High-Fidelity Blender Render Script for Sonoma Autocross Digital Twin
- Configures PBR Materials (Dark Paddock Asphalt, Fluorescent Orange & Yellow Cones)
- Sets up realistic sun and sky lighting
- Renders 3 perspective angles:
  1. Elevated 3/4 Drone Perspective of the entire autocross course
  2. Driver's Cockpit Launch View at the Start Line
  3. Close-up Action View of the Slalom & Hairpin Apex Cones
- Saves the complete Blender project (.blend)
"""

import bpy
import os
import math
from mathutils import Vector

def setup_and_render():
    # 1. Reset Scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # 2. Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ac_autox_dir = os.path.abspath(os.path.join(script_dir, ".."))
    track_dir = os.path.join(ac_autox_dir, "content", "tracks", "sonoma_autocross")
    obj_path = os.path.join(track_dir, "sonoma_autocross.obj")
    blend_path = os.path.join(track_dir, "sonoma_autocross.blend")

    out_drone = os.path.abspath(os.path.join(ac_autox_dir, "..", "blender_drone_perspective.png"))
    out_launch = os.path.abspath(os.path.join(ac_autox_dir, "..", "blender_driver_launch_view.png"))
    out_slalom = os.path.abspath(os.path.join(ac_autox_dir, "..", "blender_slalom_closeup.png"))

    print(f"Importing OBJ: {obj_path}")
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=obj_path)
    else:
        bpy.ops.import_scene.obj(filepath=obj_path)

    # 3. Setup AC Dummies
    ac_nodes = [
        ("AC_START_0", (-32.5, 118.0, 1.32), 155.0),
        ("AC_PIT_0", (-36.0, 122.0, 1.36), 155.0),
        ("AC_HOTLAP_START_0", (-32.5, 118.0, 1.32), 155.0),
        ("AC_TIME_0_L", (-41.90, 105.48, 1.14), 145.0),
        ("AC_TIME_0_R", (-24.44, 113.25, 1.29), 145.0),
        ("AC_TIME_1_L", (34.92, -87.71, -0.95), 134.0),
        ("AC_TIME_1_R", (19.21, -95.49, -1.09), 134.0)
    ]
    ac_col = bpy.data.collections.new("AC_SPAWNS_AND_GATES")
    bpy.context.scene.collection.children.link(ac_col)

    for name, (x, y, z), heading_deg in ac_nodes:
        empty = bpy.data.objects.new(name, None)
        empty.empty_display_type = 'ARROWS'
        empty.empty_display_size = 2.0
        empty.location = (x, y, z)
        rot_z = math.radians(90.0 - heading_deg)
        empty.rotation_euler = (0, 0, rot_z)
        ac_col.objects.link(empty)

    # 4. Enhance Materials for High-Contrast 3D Visualization
    def create_principled_mat(name, color, roughness=0.5, emission=(0,0,0,1)):
        mat = bpy.data.materials.get(name)
        if not mat:
            mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs['Base Color'].default_value = color
            bsdf.inputs['Roughness'].default_value = roughness
            if 'Emission Color' in bsdf.inputs:
                bsdf.inputs['Emission Color'].default_value = emission
            elif 'Emission' in bsdf.inputs:
                bsdf.inputs['Emission'].default_value = emission[:3]
        return mat

    # Asphalt Paddock with Satellite Imagery Texture
    asphalt_mat = bpy.data.materials.get("MAT_ASPHALT_PADDOCK")
    if not asphalt_mat:
        asphalt_mat = bpy.data.materials.new(name="MAT_ASPHALT_PADDOCK")
    asphalt_mat.use_nodes = True
    a_nodes = asphalt_mat.node_tree.nodes
    a_links = asphalt_mat.node_tree.links
    a_bsdf = a_nodes.get("Principled BSDF")
    if a_bsdf:
        tex_path = os.path.join(track_dir, "sonoma_paddock_z19.jpg")
        if os.path.exists(tex_path):
            tex_img = bpy.data.images.load(tex_path)
            tex_node = a_nodes.new(type="ShaderNodeTexImage")
            tex_node.image = tex_img
            a_links.new(tex_node.outputs['Color'], a_bsdf.inputs['Base Color'])
            a_bsdf.inputs['Roughness'].default_value = 0.85
        else:
            a_bsdf.inputs['Base Color'].default_value = (0.12, 0.13, 0.15, 1.0)

    # Bright Fluorescent Orange Cones
    create_principled_mat("MAT_CONE_ORANGE", (1.0, 0.28, 0.02, 1.0), roughness=0.35, emission=(0.2, 0.05, 0.0, 1.0))
    # Bright Yellow Apex Cones
    create_principled_mat("MAT_CONE_YELLOW", (1.0, 0.88, 0.05, 1.0), roughness=0.35, emission=(0.2, 0.18, 0.0, 1.0))
    # Green Timing Sensor Poles
    create_principled_mat("MAT_TIMING_SENSOR", (0.05, 0.95, 0.35, 1.0), roughness=0.2, emission=(0.1, 0.8, 0.2, 1.0))
    # White Chalk Markings
    create_principled_mat("MAT_CHALK", (0.95, 0.95, 0.95, 1.0), roughness=0.9)

    # 5. Sun & Sky Environment
    sun_data = bpy.data.lights.new(name="Sun", type='SUN')
    sun_data.energy = 4.0
    sun_data.angle = math.radians(2.0)
    sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
    sun_obj.location = (30, -80, 100)
    sun_obj.rotation_euler = (math.radians(52), math.radians(25), math.radians(-40))
    bpy.context.scene.collection.objects.link(sun_obj)

    # World Sky
    world = bpy.data.worlds.new("AutoxSky")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.6, 0.72, 0.85, 1.0)
        bg.inputs['Strength'].default_value = 1.0

    # 6. Camera Setup
    def look_at(cam_obj, target):
        direction = target - cam_obj.location
        rot_quat = direction.to_track_quat('-Z', 'Y')
        cam_obj.rotation_euler = rot_quat.to_euler()

    cam_data = bpy.data.cameras.new(name="MainCamera")
    cam_data.clip_end = 1500.0
    cam_obj = bpy.data.objects.new(name="MainCamera", object_data=cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    scene = bpy.context.scene
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080

    # VIEW 1: Drone 3/4 Elevated Overview (Captures all 127 cones across the paddock)
    cam_data.lens = 28
    cam_obj.location = Vector((-45.0, -160.0, 85.0))
    look_at(cam_obj, Vector((10.0, 15.0, 0.0)))
    scene.render.filepath = out_drone
    print("Rendering Drone Overview...")
    bpy.ops.render.render(write_still=True)

    # VIEW 2: Driver's Cockpit Launch View (At Start Gate looking at launch cones)
    cam_data.lens = 45
    cam_obj.location = Vector((-32.5, 126.0, 1.8))
    look_at(cam_obj, Vector((-31.0, 95.0, 0.8)))
    scene.render.filepath = out_launch
    print("Rendering Cockpit Launch View...")
    bpy.ops.render.render(write_still=True)

    # VIEW 3: Slalom & Hairpin Close-up (Shows orange cones, yellow apex cone, pointer cone)
    cam_data.lens = 50
    cam_obj.location = Vector((5.0, 40.0, 8.0))
    look_at(cam_obj, Vector((-5.0, 75.0, 1.0)))
    scene.render.filepath = out_slalom
    print("Rendering Slalom Close-up...")
    bpy.ops.render.render(write_still=True)

    # 7. Save .blend file
    print(f"Saving Blender project to: {blend_path}")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print("All renders and project saved successfully!")

if __name__ == "__main__":
    setup_and_render()
