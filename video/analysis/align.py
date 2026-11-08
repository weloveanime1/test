import json, re, numpy as np, soundfile as sf, stable_whisper
audio, sr = sf.read("/tmp/song.wav", dtype="float32"); assert sr==16000
WIN = {"Intro":(0,15.6),"Pre-Chorus":(15.6,37.0),"Verse 1":(39.5,77.0),"Chorus":(76.8,97.3),
       "Verse 2":(97.3,139.2),"Chorus#2":(139.2,157.5),"Verse 3":(157.5,196.6),"Bridge":(196.6,217.0),
       "Final Chorus":(217.0,244.2),"Outro":(244.2,263.2)}
raw=open("lyrics.txt").read(); cur=None; secs=[]; seen={}
for ln in raw.splitlines():
    m=re.match(r"\[(.+)\]", ln.strip())
    if m:
        name=m.group(1); seen[name]=seen.get(name,0)+1
        key = name if seen[name]==1 else f"{name}#{seen[name]}"
        secs.append([name,key,[]]); continue
    if ln.strip(): secs[-1][2].append(ln.strip())
model=stable_whisper.load_faster_whisper("small", device="cpu", compute_type="int8")
out=[]
for name,key,lines in secs:
    a,b = WIN[key]; clip = audio[int(a*sr):int(b*sr)]
    res = model.align(clip, "\n".join(lines), language="en", original_split=True, verbose=None)
    segs=res.segments
    assert len(segs)==len(lines), (key,len(segs),len(lines))
    for seg,txt in zip(segs,lines):
        out.append({"section":name,"text":txt,"start":round(seg.start+a,3),"end":round(seg.end+a,3),
          "words":[{"w":w.word.strip(),"s":round(w.start+a,3),"e":round(w.end+a,3)} for w in seg.words]})
json.dump(out,open("lines.json","w"),indent=1)
for o in out: print(f"{o['start']:7.2f} {o['end']:7.2f} [{o['section'][:6]}] {o['text'][:60]}")
