// PWA 圖示的 SVG 原稿（設計 A：墨藍底 + 2×2 P／I／C／O 四色方塊）。
// 字母以幾何路徑繪製、不依賴字型，各平台渲染一致。顏色取自 src/ui/styles.css 的 :root token。

export const COLORS = {
  ink: '#18212f',
  p: '#1b5ab8',
  i: '#0b7560',
  c: '#8a5600',
  o: '#9d3470',
  glyph: '#ffffff',
};

const TILE = 176;
const GAP = 16;
const GRID = TILE * 2 + GAP; // 368

// 每個字母在 176×176 方塊內的路徑（中心 88,88）
const GLYPHS = {
  P: 'M62 136V40H98A26 26 0 0 1 98 92H62',
  I: 'M66 40H110M88 40V136M66 136H110',
  C: 'M123.2 58.4A46 46 0 1 0 123.2 117.6',
  O: 'M88 42A46 46 0 1 1 87.99 42Z',
};

function tile(letter, color, x, y) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<rect width="${TILE}" height="${TILE}" rx="28" fill="${color}"/>` +
    `<path d="${GLYPHS[letter]}" fill="none" stroke="${COLORS.glyph}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>`
  );
}

/**
 * @param {{ maskable?: boolean, size?: number }} options
 * maskable：全幅不透明底，四色方塊縮進 80% 安全區（方塊四角落在半徑 0.4 的圓內）。
 */
export function iconSvg({ maskable = false, size = 512 } = {}) {
  const scale = maskable ? 288 / GRID : 1; // 288 = 2 × 204.8 / √2，取整
  const offset = (512 - GRID * scale) / 2;
  const background = maskable
    ? `<rect width="512" height="512" fill="${COLORS.ink}"/>`
    : `<rect width="512" height="512" rx="104" fill="${COLORS.ink}"/>`;
  const grid =
    tile('P', COLORS.p, 0, 0) +
    tile('I', COLORS.i, TILE + GAP, 0) +
    tile('C', COLORS.c, 0, TILE + GAP) +
    tile('O', COLORS.o, TILE + GAP, TILE + GAP);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">` +
    `<title>PICO 檢索語法轉換器</title>` +
    background +
    `<g transform="translate(${offset} ${offset}) scale(${scale})">${grid}</g>` +
    `</svg>\n`
  );
}
