"""Generate the scenery behind the exact playable geometry through Image2."""
import runpy
import sys
from pathlib import Path
skill = Path('C:/Users/Zhuym/.codex/skills/gpt-image-2/scripts/gpt_image.py')
prompt = '''Create a new production background asset for an Arknights-style industrial tactical game, a fixed high-angle 2.5D mechanical chamber. Landscape 8:5 composition. Use cool steel blue, graphite and muted lavender-grey, sharp painted game-environment surfaces, restrained amber equipment lights and realistic ambient occlusion. Rich industrial detail, never minimalist flat vector art.

Composition is specified in a 960x600 coordinate system (scale proportionally to output):
- The upper band y=0..200 is a layered mechanical back wall. At upper-left, a bank of tall weathered electrical control cabinets. Across the top, horizontal pipes, a cylindrical motor, exposed cable bundles and ventilation grilles. A low safety railing, a narrow maintenance walkway, and small yellow-black hazard strips run behind the playable floor near y=185..205. Cabinets, conduits and machinery stay entirely within this band.
- Along the very narrow side margins outside the playable floor, dark inset steel walls, realistic bolts, panel seams and short recessed conduits. No decorative floating panels or emblems.
- The PLAYABLE FLOOR is a completely empty, continuous, smooth cool lavender-grey metal surface. Its four corners are (111,213), (849,213), (934,538), (26,538). This zone must contain ONLY a uniform fine brushed metal texture with slight scuffs. NO tile lines, NO squares, NO raised blocks, NO objects, NO hatches, NO grilles, NO shadows from large objects. The game's exact grid, obstacles and gates will be drawn separately. Keep this surface light enough for dark orange insect silhouettes to be seen clearly.
- In the bottom strip y=560..600, a low dark steel foreground frame with rivets and subdued hazard striping, entirely below the playable floor.

Camera: perspective looking down at the floor, vertical object edges stay vertical; floor columns spread slightly toward the bottom. The rear wall is detailed and layered, the floor stays quiet. Lighting: soft overhead diffuse light, subtle blue ambient reflections, no glowing fog, no dramatic sunbeams. The machinery must be cohesive painted game art, not schematic line work.

NO gates or red/blue wireframe cubes, NO insects or people, NO obstacles or elevated platforms, NO L-shaped pipe crossing the playfield, NO outlined panels at the sides, NO purple hexagon badges, NO UI, NO lettering, NO numbers, NO watermark. Deliver only the environment illustration, no mockup frame.'''
Path('art').mkdir(exist_ok=True)
Path('art/image2-chamber-prompt.txt').write_text(prompt, encoding='utf-8')
sys.argv = [str(skill), 'generate', '--size', '1536x960', '-p', prompt, '-o', 'art/image2-chamber.png']
runpy.run_path(str(skill), run_name='__main__')

# Fit the painted wall/floor junction to the back edge of the existing board.
from PIL import Image
source = Image.open('art/image2-chamber.png').convert('RGB').resize((1536, 960))
scene = Image.new('RGB', source.size)
for source_top, source_bottom, target_top, target_bottom in [
    (0, 202, 0, 330), (202, 895, 330, 896), (895, 960, 896, 960)
]:
    band = source.crop((0, source_top, 1536, source_bottom))
    scene.paste(band.resize((1536, target_bottom-target_top), Image.Resampling.LANCZOS), (0, target_top))
scene.save('art/chamber-background.webp', quality=88, method=6)
