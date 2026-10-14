"""Genera los iconos de 4TIMER (dígito LED rojo '4' sobre negro). Uso: python3 tools_make_icons.py"""
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 1024
def hseg(cx, cy, ln, th):
    h, t = ln / 2, th / 2
    return [(cx-h, cy), (cx-h+t, cy-t), (cx+h-t, cy-t), (cx+h, cy), (cx+h-t, cy+t), (cx-h+t, cy+t)]
def vseg(cx, cy, ln, th):
    h, t = ln / 2, th / 2
    return [(cx, cy-h), (cx+t, cy-h+t), (cx+t, cy+h-t), (cx, cy+h), (cx-t, cy+h-t), (cx-t, cy-h+t)]
# Segmentos del 4 (f, b, g, c) en caja 56x96, como en el reloj de la app
SEGS = [vseg(6, 27, 38, 10), vseg(50, 27, 38, 10), hseg(28, 48, 40, 10), vseg(50, 69, 38, 10)]
GHOST = [hseg(28, 6, 40, 10), hseg(28, 90, 40, 10), vseg(6, 69, 38, 10)]

def make(size, scale_digit):
    k = size * scale_digit / 96.0
    ox = (size - 56 * k) / 2 - 3 * k          # compensa la inclinación
    oy = (size - 96 * k) / 2
    def tr(p):
        x, y = p
        x = x + (96 - y) * 0.13                 # inclinación tipo cursiva
        return (ox + x * k, oy + y * k)
    def layer(segs, color):
        im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        for s in segs:
            d.polygon([tr(p) for p in s], fill=color)
        return im
    bg = Image.new('RGBA', (size, size), (5, 5, 6, 255))
    bg = Image.alpha_composite(bg, layer(GHOST, (255, 45, 45, 28)))
    on = layer(SEGS, (255, 45, 45, 255))
    glow = on.filter(ImageFilter.GaussianBlur(size * 0.03))
    glow.putalpha(glow.getchannel('A').point(lambda a: int(a * 0.8)))
    bg = Image.alpha_composite(bg, glow)
    return Image.alpha_composite(bg, on).convert('RGB')

out = 'www/icons/'
make(S, 0.62).resize((512, 512), Image.LANCZOS).save(out + 'icon-512.png')
make(S, 0.62).resize((192, 192), Image.LANCZOS).save(out + 'icon-192.png')
make(S, 0.46).resize((512, 512), Image.LANCZOS).save(out + 'icon-512-maskable.png')  # zona segura de iconos adaptativos
make(S, 0.62).save(out + 'icon-1024.png')
print('iconos listos')
