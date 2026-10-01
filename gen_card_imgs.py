# -*- coding: utf-8 -*-
"""生成 card_imgs.js：20 张透明卡片贴纸 WebP base64"""
from PIL import Image
import os, base64

d = r'E:\P5X_assets\特训日常_日程表\角色贴纸卡'
lines = []
for sn in range(400450, 400470):
    p = os.path.join(d, 'SPR_item-%d.png' % sn)
    im = Image.open(p).convert('RGBA')
    w, h = im.size
    if w > 200:
        im = im.resize((200, int(h * 200 / w)), Image.LANCZOS)
    bbox = im.getchannel('A').getbbox()
    if bbox: im = im.crop(bbox)
    buf = os.path.join(r'C:\Users\guoha\.doubao\lark-chats\2026-09-28\new-chat-2\_p5x_web\_cards', 'card-%d.webp' % sn)
    os.makedirs(os.path.dirname(buf), exist_ok=True)
    im.save(buf, 'WEBP', lossless=True)
    b64 = base64.b64encode(open(buf, 'rb').read()).decode()
    lines.append('  "%d": "data:image/webp;base64,%s"' % (sn, b64))

js = 'window.CARD_IMGS = {\n' + ',\n'.join(lines) + '\n};\n'
outp = r'C:\Users\guoha\.doubao\lark-chats\2026-09-28\new-chat-2\_p5x_web\card_imgs.js'
open(outp, 'w', encoding='utf-8', newline='').write(js)
print('written', outp, os.path.getsize(outp)//1024, 'KB')
