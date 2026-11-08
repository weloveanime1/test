import {continueRender, delayRender, staticFile} from 'remotion';

const FONTS: [string, string, FontFaceDescriptors][] = [
  ['Anton', 'fonts/Anton.ttf', {}],
  ['Bebas Neue', 'fonts/BebasNeue.ttf', {}],
  // Variable fonts must declare their weight range, otherwise Chrome synthesizes bold.
  ['Inter', 'fonts/Inter.ttf', {weight: '100 900'}],
  ['Cinzel', 'fonts/Cinzel.ttf', {weight: '400 900'}],
];
// CSS backgrounds/masks are not awaited by Remotion, so decode them before the first frame.
const TEXTURES = ['tex/smoke0.png', 'tex/smoke1.png', ...[0, 1, 2, 3, 4, 5].map((i) => `tex/grain${i}.png`)];
const keep: HTMLImageElement[] = [];

if (typeof document !== 'undefined') {
  const handle = delayRender('fonts and textures');
  const fonts = FONTS.map(async ([name, path, desc]) => {
    const f = new FontFace(name, `url(${staticFile(path)})`, desc);
    await f.load();
    (document.fonts as unknown as {add: (f: FontFace) => void}).add(f);
  });
  const images = TEXTURES.map((p) => {
    const img = new Image();
    img.src = staticFile(p);
    keep.push(img);
    return img.decode();
  });
  Promise.all([...fonts, ...images])
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error(e);
      continueRender(handle);
    });
}
