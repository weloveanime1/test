"""Generates tileable smoke masks and film-grain tiles into public/tex/."""
import os

import numpy as np
from PIL import Image

rng = np.random.default_rng(7)
os.makedirs("public/tex", exist_ok=True)


def fractal(h, w, beta):
    # Spectral synthesis is periodic by construction, so the texture tiles seamlessly.
    spec = np.fft.fft2(rng.standard_normal((h, w)))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2)
    f[0, 0] = 1
    n = np.real(np.fft.ifft2(spec / f ** (beta / 2)))
    return (n - n.mean()) / n.std()


for i, beta in enumerate([2.7, 2.3]):
    n = fractal(1024, 2048, beta)
    a = np.clip(0.5 + 0.28 * n, 0, 1)
    a = np.clip((a - 0.42) / 0.58, 0, 1) ** 1.5
    img = np.zeros((1024, 2048, 4), np.uint8)
    img[..., :3] = 255
    img[..., 3] = (a * 255).astype(np.uint8)
    Image.fromarray(img, "RGBA").save(f"public/tex/smoke{i}.png", optimize=True)

for i in range(6):
    g = np.clip(rng.normal(0.5, 0.2, (512, 512)), 0, 1)
    Image.fromarray((g * 255).astype(np.uint8), "L").save(f"public/tex/grain{i}.png", optimize=True)

print("textures ok", sorted(os.listdir("public/tex")))
