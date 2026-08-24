# -*- coding: utf-8 -*-
"""物理提亮美术资源（直接修改 PNG 像素，任何浏览器渲染一致）
用法：python scripts/brighten_assets.py
- 背景图亮度 +35%（RGB 不透明）
- 敌人立绘亮度 +45%（保持透明通道）
- 车厢/地图资源 +25%
- 卡牌底框 +15%（本身较亮）
- 英雄立绘 +20%
"""
from pathlib import Path
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets'

# 目录 → 亮度倍率
PLAN = {
    'bg': 1.55,          # 背景图（都很暗，物理提亮为主）
    'enemies': 1.45,     # 敌人立绘（暗）
    'heroes': 1.2,       # 英雄立绘
    'train': 1.25,       # 车厢顶部/剪影（剪影保持黑：亮度1.0）
    'map': 1.3,          # 节点图标/铁轨
    'cards': 1.15,       # 品质底框
    'ui': 1.1,           # 按钮/图标/表盘
}


def brighten(path: Path, mult: float):
    if mult <= 1.0:
        return False
    img = Image.open(path)
    has_alpha = img.mode in ('RGBA', 'LA')
    if has_alpha:
        # 分离 alpha，只提亮 RGB
        rgba = img.convert('RGBA')
        rgb = rgba.convert('RGB')
        rgb = ImageEnhance.Brightness(rgb).enhance(mult)
        rgb.putalpha(rgba.getchannel('A'))
        img = rgb
    else:
        img = ImageEnhance.Brightness(img).enhance(mult)
    img.save(path)
    return True


total = 0
for sub, mult in PLAN.items():
    folder = ROOT / sub
    if not folder.exists():
        continue
    for f in sorted(folder.rglob('*.png')):
        # 列车剪影保持黑色剪影（提亮无意义且破坏效果）
        if 'silhouette' in f.name:
            continue
        if brighten(f, mult):
            total += 1
            print(f'  [x{mult}] {f.relative_to(ROOT)}')
print(f'完成：共提亮 {total} 个资源')
