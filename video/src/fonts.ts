import {continueRender, delayRender, staticFile} from 'remotion';

const FONTS: [string, string][] = [
  ['Anton', 'fonts/Anton.ttf'], ['Bebas Neue', 'fonts/BebasNeue.ttf'], ['Inter', 'fonts/Inter.ttf'], ['Cinzel', 'fonts/Cinzel.ttf'],
];
if (typeof document !== 'undefined') {
  const handle = delayRender('fonts');
  Promise.all(FONTS.map(async ([name, path]) => {
    const f = new FontFace(name, `url(${staticFile(path)})`);
    await f.load();
    (document.fonts as unknown as {add: (f: FontFace) => void}).add(f);
  })).then(() => continueRender(handle)).catch((e) => { console.error(e); continueRender(handle); });
}
