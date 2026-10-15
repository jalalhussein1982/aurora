"""Prepare a full-resolution alpha mask for curve fitting; preserve the source PNG."""
import json
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parents[1] / 'output/brand/working/aurora-logo-generated-cutout-not-approved.png'
im = Image.open(SOURCE).convert('RGBA')
# Work at the original resolution. Remove sub-pixel glow noise before vector fitting.
alpha = im.getchannel('A').filter(ImageFilter.GaussianBlur(1.4))
mask = alpha.point(lambda p: 255 if p >= 175 else 0)
mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
ImageOps.invert(mask).save(ROOT / 'alpha-mask.png')
metadata = {'width':im.width,'height':im.height,'sourceWidth':im.width,'sourceHeight':im.height,
            'alphaThreshold':175,'blurRadius':1.4,'method':'Full-resolution cubic Bezier fitting'}
(ROOT/'contours.json').write_text(json.dumps(metadata,indent=2))
print(json.dumps(metadata))
