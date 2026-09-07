"""Localize the existing library in place, preserving scenes and edited variants."""
import bpy
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source_file = Path(bpy.data.filepath)
assert source_file.name == '2026-city-lookdev.blend'
assert not bpy.data.collections.get('ASSET_LIBRARY'), 'Already consolidated'
stamp = source_file.stat().st_mtime_ns
before_scenes = {s.name: len(s.objects) for s in bpy.data.scenes}
chosen = []
expected_dimensions = {}
for group in ('residential', 'commercial', 'skyscraper'):
    manifest = json.loads((root / f'public/assets/models/buildings/textured-{group}-pilot/manifest.json').read_text())
    for model in manifest['models']:
        expected_dimensions[model['id']] = model['dimensionsMetres']
        candidates = [o for o in bpy.data.objects if o.name == model['sourceObject']]
        # Linked originals are the old exporter sources; retain edited local copies too.
        candidates.sort(key=lambda o: o.library is None)
        assert candidates, model['id']
        obj = candidates[0]
        chosen.append((obj, group, model['id'], model['sourceObject']))
approved = bpy.data.collections['EXPORT_APPROVED_BUILDINGS']
manifest = json.loads((root / 'public/assets/models/buildings/textured-approved-pilot/manifest.json').read_text())
for model in manifest['models']:
    chosen.append((approved.objects[model['sourceObject']], 'approved', model['id'], model['sourceObject']))
# Resolve image paths while their linked-library base paths still exist.
for image in bpy.data.images:
    if image.library and image.filepath:
        image.filepath = bpy.path.abspath(image.filepath, library=image.library)
# ALL localizes linked IDs and their dependencies, remapping existing users.
bpy.ops.object.make_local(type='ALL')
assert not any(o.library for o in bpy.data.objects), 'Linked objects remain'
asset_root = bpy.data.collections.new('ASSET_LIBRARY')
for group in ('residential', 'commercial', 'skyscraper'):
    collection = bpy.data.collections.new('ASSETS / ' + group)
    asset_root.children.link(collection)
    for obj, category, asset_id, original_name in chosen:
        if category == group:
            collection.objects.link(obj)
asset_root.children.link(approved)
for obj, category, asset_id, original_name in chosen:
    assert obj.library is None and obj.data.library is None
    obj['runtime_asset_id'] = asset_id
    obj['runtime_asset_group'] = category
    obj['original_export_source'] = original_name
    obj['export_approved'] = True
    if asset_id in expected_dimensions:
        def persistent(o):
            return o.matrix_basis.copy() if o.parent is None else persistent(o.parent) @ o.matrix_parent_inverse @ o.matrix_basis
        points = [persistent(obj) @ v.co for v in obj.data.vertices]
        height = max(p.z for p in points) - min(p.z for p in points)
        ratio = expected_dimensions[asset_id]['height'] / height
        if abs(ratio - 1) > 0.001:
            obj['runtime_export_scale'] = ratio
            obj['runtime_export_scale_note'] = 'Preserve established runtime metre scale; source geometry unchanged.'
asset_scene = bpy.data.scenes.new('Asset Library')
asset_scene.collection.children.link(asset_root)
export_scene = bpy.data.scenes['EXPORT / Approved buildings']
export_scene.collection.children.unlink(approved)
export_scene.collection.children.link(asset_root)
workshop = bpy.data.scenes.new('Workshop')
workshop.collection.children.link(bpy.data.collections['LOOKDEV_EXPERIMENTS'])
# Preserve existing scene names, lighting, city placements and all local copies.
for scene in bpy.data.scenes:
    if scene.name in before_scenes and scene != export_scene:
        assert len(scene.objects) == before_scenes[scene.name], scene.name
assert len(asset_scene.objects) == 76
assert len(export_scene.objects) == 76
remaining = [lib for lib in bpy.data.libraries if lib.users == 0]
for lib in remaining:
    bpy.data.libraries.remove(lib)

for prop in bpy.data.bl_rna.properties:
    data = getattr(bpy.data, prop.identifier, None)
    if not hasattr(data, '__iter__') or isinstance(data, str):
        continue
    for item in data:
        if isinstance(item, bpy.types.ID) and item.library and hasattr(item, 'make_local'):
            item.make_local()
for lib in list(bpy.data.libraries):
    if lib.users == 0:
        bpy.data.libraries.remove(lib)
linked_ids = [item for item in bpy.data.user_map() if item.library]
assert not linked_ids, [(i.name, type(i).__name__) for i in linked_ids]
for lib in list(bpy.data.libraries):
    bpy.data.libraries.remove(lib)
assert len(bpy.data.libraries) == 0
report = {'master': str(source_file), 'models': [{'id':i, 'group':g, 'object':o.name, 'previousSource':n} for o,g,i,n in chosen], 'scenes': {s.name:len(s.objects) for s in bpy.data.scenes}, 'libraries':len(bpy.data.libraries)}
assert source_file.stat().st_mtime_ns == stamp, 'Source changed during consolidation'
backup = source_file.with_suffix('.blend.pre-consolidation.bak')
assert not backup.exists(), 'Preserve existing consolidation backup'
shutil.copy2(source_file, backup)
bpy.context.window.scene = asset_scene
bpy.context.preferences.filepaths.save_version = max(1, bpy.context.preferences.filepaths.save_version)
bpy.ops.wm.save_as_mainfile(filepath=str(source_file))
(root / 'references/visual/atlas-shape-study/consolidation.json').write_text(json.dumps(report, indent=2)+'\n')
print('CONSOLIDATED',json.dumps(report))
