"""
Assetto Corsa Sonoma Autocross - Blender Importer & Exporter
Usage in Blender:
1. Open Blender
2. Open Text Editor -> Open this script
3. Click 'Run Script'
Or run via CLI: blender --background --python scripts/import_to_blender.py
"""

import bpy
import os
import math

def setup_ac_track():
    # 1. Clean default scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    # 2. Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.abspath(os.path.join(script_dir, ".."))
    track_dir = os.path.join(project_dir, "content", "tracks", "sonoma_autocross")
    obj_path = os.path.join(track_dir, "sonoma_autocross.obj")
    fbx_path = os.path.join(track_dir, "sonoma_autocross.fbx")
    
    print(f"Importing OBJ: {obj_path}")
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=obj_path)
    else:
        bpy.ops.import_scene.obj(filepath=obj_path)
        
    # 3. Setup AC Dummies / Empties
    ac_nodes = [
        ("AC_START_0", (-32.5, 118.0, 1.32), 155.0),
        ("AC_PIT_0", (-36.0, 122.0, 1.36), 155.0),
        ("AC_HOTLAP_START_0", (-32.5, 118.0, 1.32), 155.0),
        ("AC_TIME_0_L", (-41.90, 105.48, 1.14), 145.0),
        ("AC_TIME_0_R", (-24.44, 113.25, 1.29), 145.0),
        ("AC_TIME_1_L", (34.92, -87.71, -0.95), 134.0),
        ("AC_TIME_1_R", (19.21, -95.49, -1.09), 134.0)
    ]
    
    ac_collection = bpy.data.collections.new("AC_SPAWNS_AND_GATES")
    bpy.context.scene.collection.children.link(ac_collection)
    
    for name, (x, y, z), heading_deg in ac_nodes:
        # Check if mesh object already exists with this name and delete it
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
            
        # Create Blender Empty with Arrows
        empty = bpy.data.objects.new(name, None)
        empty.empty_display_type = 'ARROWS'
        empty.empty_display_size = 1.0
        # In Blender: X=East, Y=North, Z=Up
        empty.location = (x, y, z)
        # Heading: 0 is North (+Y), 90 is East (+X), 180 is South (-Y)
        # Blender rotation Z: 0 is +X, 90 is +Y
        # Z rotation in radians:
        rot_z = math.radians(90.0 - heading_deg)
        empty.rotation_euler = (0, 0, rot_z)
        ac_collection.objects.link(empty)
        print(f"Created AC Empty: {name} at ({x}, {y}, {z}) heading {heading_deg} deg")

    # 4. Verify Road Surface
    road_obj = bpy.data.objects.get("1ROAD_paddock")
    if road_obj:
        print("Found collision surface: 1ROAD_paddock (prefix '1' active)")
        
    # 5. Export to FBX
    print(f"Exporting AC-ready FBX to: {fbx_path}")
    bpy.ops.export_scene.fbx(
        filepath=fbx_path,
        check_existing=False,
        use_selection=False,
        global_scale=1.0,
        apply_unit_scale=True,
        apply_scale_options='FBX_SCALE_ALL',
        axis_forward='-Z',
        axis_up='Y',
        bake_space_transform=True,
        object_types={'EMPTY', 'MESH'},
        use_mesh_modifiers=True,
        mesh_smooth_type='FACE'
    )
    print("Export complete!")

if __name__ == "__main__":
    setup_ac_track()
