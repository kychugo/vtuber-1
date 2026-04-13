# VTuber Original Short — Manual Tuning Guide

This file explains every setting you can tweak by hand to control **caption size**, **video smoothness**, and other quality parameters.  
All changes live in **`scripts/generate_original_short.py`** unless noted otherwise.

---

## 1. Caption / Subtitle Size

### 1a. Words per subtitle line — `chunk_size`

```python
# Line ~343
chunk_size = 3          # ← change this number
```

| Value | Effect |
|-------|--------|
| `2`   | Very short lines — barely 2 words at a time (most minimal) |
| `3`   | ✅ Current — compact, easy to read |
| `4`   | Slightly longer lines |
| `6`   | Long lines, can wrap and cover more screen |

**Rule of thumb:** smaller number = fewer words on screen at once = feels smaller.

---

### 1b. Font size — `FontSize`

```python
# Line ~392 (inside the video_filter string)
f"FontName=Liberation Sans,FontSize=14,Bold=1,"  # ← change 14
```

| Value | Visual size on a 1080×1920 Short |
|-------|----------------------------------|
| `10`  | Very tiny — nearly invisible on mobile |
| `14`  | ✅ Current — small, unobtrusive |
| `22`  | Medium |
| `38`  | Large — occupies significant screen space |

**Recommendation:** stay between `12` and `18` for a clean look.

---

### 1c. Caption bar height — `drawbox` height

```python
# Line ~390
f"drawbox=y=ih-80:color=0x000000AA:width=iw:height=80:t=fill,"
#                        ^^^^ y offset    ^^^^ bar height
```

The dark translucent bar behind the subtitles.  
Both `y=ih-80` and `height=80` must match (both = bar height in pixels).

| Height | Effect |
|--------|--------|
| `60`   | Very thin strip |
| `80`   | ✅ Current |
| `150`  | Taller bar, more opaque area |
| `310`  | Large bar, subtitle area takes up ~16% of screen height |

**To change to, say, 100 px:**
```python
f"drawbox=y=ih-100:color=0x000000AA:width=iw:height=100:t=fill,"
```

---

### 1d. Vertical margin from bottom — `MarginV`

```python
f"Shadow=1,Alignment=2,MarginV=18'"  # ← change 18
```

How many pixels above the very bottom edge the text sits.

| Value | Effect |
|-------|--------|
| `10`  | Text very close to bottom edge |
| `18`  | ✅ Current |
| `30`  | More padding from the bottom |
| `55`  | Lots of space, text floats higher |

---

### 1e. Caption bar transparency — `color`

```python
f"drawbox=y=ih-80:color=0x000000AA:..."
#                           ^^^^ AA = opacity in hex
```

The last two hex digits control opacity: `00` = fully transparent, `FF` = fully opaque.

| Value | Opacity |
|-------|---------|
| `55`  | ~33% — very transparent |
| `AA`  | ~67% — ✅ Current |
| `CC`  | ~80% — mostly solid |
| `FF`  | 100% — solid black |

---

### 1f. Text outline thickness — `Outline`

```python
f"PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,"
#                                                            ^^^
```

| Value | Effect |
|-------|--------|
| `0`   | No outline (hard to read on busy backgrounds) |
| `1`   | Thin outline |
| `2`   | ✅ Current — clean |
| `3`   | Thick outline |
| `4`   | Very thick, good for big fonts |

---

## 2. Video Smoothness

### 2a. Capture frame rate — `CAPTURE_FPS`

```python
# Line ~74
CAPTURE_FPS = 30   # ← change this number
```

This is how many frames Puppeteer takes per second when recording the Live2D model.

| Value | Effect |
|-------|--------|
| `10`  | Choppy — obvious stutter |
| `24`  | Cinema-like |
| `30`  | ✅ Current — smooth, standard |
| `60`  | Very smooth, but **3× slower to generate** (60 screenshots/sec) |

> ⚠️ Raising this above `30` significantly increases generation time.

---

### 2b. Motion interpolation — `minterpolate` (FFmpeg filter)

```python
# Line ~390 (inside video_filter)
f"fps=30,"
f"minterpolate=fps=60:mi_mode=blend,"
```

FFmpeg synthetically generates in-between frames to reach a higher frame rate.

| Setting | Effect |
|---------|--------|
| Remove the line entirely | Output stays at 30fps, no interpolation |
| `mi_mode=blend` | ✅ Current — fast frame blending, very smooth |
| `mi_mode=mci` | Optical-flow interpolation — highest quality, **very slow** |
| `fps=60` | Target output frame rate (60fps Shorts are supported by YouTube) |
| `fps=30` | Disable interpolation upsample (change fps back to 30) |

**To disable interpolation and keep 30fps output:**
```python
f"fps=30,"
# (delete the minterpolate line)
```

**To use high-quality optical flow interpolation (slow, best quality):**
```python
f"fps=30,"
f"minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,"
```

---

### 2c. Output frame rate — `VIDEO_FPS`

```python
# Line ~78
VIDEO_FPS = 30   # ← informational; the actual fps is set by minterpolate above
```

If you remove `minterpolate`, set `fps={VIDEO_FPS}` back in the filter chain and change `VIDEO_FPS` to your desired rate.

---

### 2d. FFmpeg encoding quality — `crf` and `preset`

```python
# Line ~426 (in compose_video)
"-c:v", "libx264", "-preset", "medium", "-crf", "20",
```

| Setting | Options | Effect |
|---------|---------|--------|
| `preset` | `ultrafast` `fast` `medium` `slow` `veryslow` | Slower preset = smaller file + better quality at same bitrate |
| `crf` | `0`–`51` (lower = better) | `18` = nearly lossless, `23` = default, `28` = noticeable loss |

**For highest quality, slowest encode:**
```python
"-preset", "slow", "-crf", "18",
```
**For fastest encode (CI speed), lower quality:**
```python
"-preset", "ultrafast", "-crf", "23",
```

---

### 2e. Capture encoding quality — `capture_live2d.js`

```js
// scripts/capture_live2d.js  line ~54
'-preset', 'fast',
'-crf',    '20',
```

Same `preset`/`crf` logic as above, but for the intermediate Live2D capture video.  
Since this file is later re-encoded by FFmpeg in `compose_video`, you can safely use `ultrafast`/`28` here to speed up the capture step without losing final quality.

```js
'-preset', 'ultrafast',
'-crf',    '28',
```

---

## 3. Quick Reference — All Key Values

| Setting | File | Current | Smaller/Smoother | Notes |
|---------|------|---------|-----------------|-------|
| Words per caption | `generate_original_short.py` line ~343 | `3` | `2` | Fewer words per line |
| Font size | `generate_original_short.py` line ~392 | `14` | `10`–`12` | Pixels |
| Bar height | `generate_original_short.py` line ~390 | `80` | `60` | Must match `y=ih-N` |
| MarginV | `generate_original_short.py` line ~394 | `18` | `12` | px from bottom |
| Capture FPS | `generate_original_short.py` line ~74 | `30` | `60` | Slower CI but native smoothness |
| Interpolation | `generate_original_short.py` line ~390 | `blend` | `mci` | `mci` = best, slow |
| Output FPS | `minterpolate fps=` | `60` | — | YouTube supports 60fps Shorts |
| Encode preset | `generate_original_short.py` line ~426 | `medium` | `slow` | Trade CI time for quality |
| Encode CRF | `generate_original_short.py` line ~426 | `20` | `18` | Lower = sharper |

---

## 4. How to Apply Changes

1. Open `scripts/generate_original_short.py` in any text editor.
2. Find the line number from the table above (use `Ctrl+G` / `Cmd+G` in most editors).
3. Change the value.
4. Commit and push — the GitHub Actions workflow will pick up the new values on the next run.

```bash
git add scripts/generate_original_short.py
git commit -m "tuning: smaller captions, smoother video"
git push
```
