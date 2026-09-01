'use strict';

/**
 * @typedef {'happy'|'angry'|'scared'|'smug'|'plead'|'zen'} CatMood
 */

/* ================= ORIGINAL CARD ART (hand-drawn wobbly SVG) ================= */
export const INK='#2a211c';
/* Wrap raw SVG shapes in a scalable <svg>. Every illustration in the game is
   built from these helpers — there are no image files anywhere. */
/**
 * @param {string} inner
 * @param {string} [vb='0 0 100 100']
 * @returns {string}
 */
export function svgWrap(inner,vb='0 0 100 100'){return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;}

/* a wobbly cat head. cx,cy,r ; fill ; mood: happy|angry|scared|smug|plead|zen */
/* The one cat face used everywhere, parameterised. cx,cy = centre, r = size,
   fill = fur colour, mood picks the eyes/mouth, extra = extra SVG on top
   (glasses, a mustache, a party hat…). */
/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {string} fill
 * @param {CatMood} [mood='happy']
 * @param {string} [extra='']
 * @returns {string}
 */
export function catHead(cx,cy,r,fill,mood='happy',extra=''){
  const s=r/30, I=INK;
  const earL=`M${cx-24*s} ${cy-14*s} L${cx-30*s} ${cy-34*s} L${cx-10*s} ${cy-26*s}`;
  const earR=`M${cx+24*s} ${cy-14*s} L${cx+30*s} ${cy-34*s} L${cx+10*s} ${cy-26*s}`;
  let eyes='',mouth='';
  const eyL=cx-11*s, eyR=cx+11*s, eyY=cy-4*s;
  if(mood==='angry'){
    eyes=`<path d="M${eyL-6*s} ${eyY-7*s} L${eyL+5*s} ${eyY-2*s}" stroke="${I}" stroke-width="${3*s}"/><path d="M${eyR+6*s} ${eyY-7*s} L${eyR-5*s} ${eyY-2*s}" stroke="${I}" stroke-width="${3*s}"/>
    <circle cx="${eyL}" cy="${eyY+3*s}" r="${3.4*s}" fill="${I}"/><circle cx="${eyR}" cy="${eyY+3*s}" r="${3.4*s}" fill="${I}"/>`;
    mouth=`<path d="M${cx-8*s} ${cy+14*s} Q${cx} ${cy+9*s} ${cx+8*s} ${cy+14*s}" stroke="${I}" stroke-width="${2.6*s}"/>`;
  }else if(mood==='scared'){
    eyes=`<circle cx="${eyL}" cy="${eyY}" r="${6*s}" fill="#fff" stroke="${I}" stroke-width="${2*s}"/><circle cx="${eyR}" cy="${eyY}" r="${6*s}" fill="#fff" stroke="${I}" stroke-width="${2*s}"/>
    <circle cx="${eyL}" cy="${eyY}" r="${2.2*s}" fill="${I}"/><circle cx="${eyR}" cy="${eyY}" r="${2.2*s}" fill="${I}"/>`;
    mouth=`<ellipse cx="${cx}" cy="${cy+13*s}" rx="${4.5*s}" ry="${6*s}" fill="${I}"/>`;
  }else if(mood==='plead'){
    eyes=`<circle cx="${eyL}" cy="${eyY}" r="${7*s}" fill="${I}"/><circle cx="${eyR}" cy="${eyY}" r="${7*s}" fill="${I}"/>
    <circle cx="${eyL+2*s}" cy="${eyY-2.4*s}" r="${2.4*s}" fill="#fff"/><circle cx="${eyR+2*s}" cy="${eyY-2.4*s}" r="${2.4*s}" fill="#fff"/>
    <circle cx="${eyL-2*s}" cy="${eyY+2*s}" r="${1.2*s}" fill="#fff"/><circle cx="${eyR-2*s}" cy="${eyY+2*s}" r="${1.2*s}" fill="#fff"/>`;
    mouth=`<path d="M${cx-5*s} ${cy+12*s} Q${cx} ${cy+16*s} ${cx+5*s} ${cy+12*s}" stroke="${I}" stroke-width="${2.6*s}"/>`;
  }else if(mood==='smug'){
    eyes=`<path d="M${eyL-5*s} ${eyY} Q${eyL} ${eyY+4*s} ${eyL+5*s} ${eyY}" stroke="${I}" stroke-width="${3*s}"/><path d="M${eyR-5*s} ${eyY} Q${eyR} ${eyY+4*s} ${eyR+5*s} ${eyY}" stroke="${I}" stroke-width="${3*s}"/>`;
    mouth=`<path d="M${cx-6*s} ${cy+12*s} Q${cx+2*s} ${cy+17*s} ${cx+9*s} ${cy+11*s}" stroke="${I}" stroke-width="${2.6*s}"/>`;
  }else if(mood==='zen'){
    eyes=`<path d="M${eyL-5*s} ${eyY} L${eyL+5*s} ${eyY}" stroke="${I}" stroke-width="${3*s}"/><path d="M${eyR-5*s} ${eyY} L${eyR+5*s} ${eyY}" stroke="${I}" stroke-width="${3*s}"/>`;
    mouth=`<path d="M${cx-5*s} ${cy+13*s} Q${cx} ${cy+16*s} ${cx+5*s} ${cy+13*s}" stroke="${I}" stroke-width="${2.6*s}"/>`;
  }else{ // happy
    eyes=`<circle cx="${eyL}" cy="${eyY}" r="${4*s}" fill="${I}"/><circle cx="${eyR}" cy="${eyY}" r="${4*s}" fill="${I}"/>
    <circle cx="${eyL+1.4*s}" cy="${eyY-1.4*s}" r="${1.3*s}" fill="#fff"/><circle cx="${eyR+1.4*s}" cy="${eyY-1.4*s}" r="${1.3*s}" fill="#fff"/>`;
    mouth=`<path d="M${cx-7*s} ${cy+11*s} Q${cx-3*s} ${cy+15*s} ${cx} ${cy+11*s} Q${cx+3*s} ${cy+15*s} ${cx+7*s} ${cy+11*s}" stroke="${I}" stroke-width="${2.4*s}"/>`;
  }
  return `
  <path d="${earL} Z" fill="${fill}" stroke="${I}" stroke-width="${3*s}"/>
  <path d="${earR} Z" fill="${fill}" stroke="${I}" stroke-width="${3*s}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${28*s}" ry="${25*s}" fill="${fill}" stroke="${I}" stroke-width="${3*s}"/>
  ${eyes}
  <path d="M${cx-3*s} ${cy+6*s} L${cx+3*s} ${cy+6*s} L${cx} ${cy+10*s} Z" fill="${I}"/>
  ${mouth}
  <path d="M${cx-28*s} ${cy+4*s} L${cx-42*s} ${cy+1*s} M${cx-28*s} ${cy+9*s} L${cx-42*s} ${cy+10*s}" stroke="${I}" stroke-width="${2*s}"/>
  <path d="M${cx+28*s} ${cy+4*s} L${cx+42*s} ${cy+1*s} M${cx+28*s} ${cy+9*s} L${cx+42*s} ${cy+10*s}" stroke="${I}" stroke-width="${2*s}"/>
  ${extra}`;
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {string} fill
 * @returns {string}
 */
export const star=(cx,cy,r,fill)=>{let p='';for(let i=0;i<10;i++){const a=Math.PI/5*i-Math.PI/2,rr=i%2?r*.45:r;p+=(i?'L':'M')+(cx+rr*Math.cos(a)).toFixed(1)+' '+(cy+rr*Math.sin(a)).toFixed(1)+' ';}return `<path d="${p}Z" fill="${fill}" stroke="${INK}" stroke-width="2.5"/>`;};

/**
 * @typedef {() => string} ArtFn
 */

/* ART[type]() returns the artwork for a card type. Keys must match CARDS. */
/** @type {Record<string, ArtFn>} */
export const ART={
  BOOM: ()=>svgWrap(`
    ${star(50,54,46,'#ffc53d')}${star(50,54,34,'#ff5233')}
    <circle cx="50" cy="58" r="24" fill="#2a211c" stroke="#2a211c" stroke-width="3"/>
    <path d="M50 34 Q46 24 56 18" stroke="#2a211c" stroke-width="4"/>
    ${star(60,14,9,'#ffc53d')}
    <path d="M28 46 L20 40 L30 38 Z" fill="#2a211c"/><path d="M72 46 L80 40 L70 38 Z" fill="#2a211c"/>
    <circle cx="42" cy="55" r="4.5" fill="#fff"/><circle cx="58" cy="55" r="4.5" fill="#fff"/>
    <circle cx="42" cy="55" r="1.8" fill="#2a211c"/><circle cx="58" cy="55" r="1.8" fill="#2a211c"/>
    <ellipse cx="50" cy="66" rx="4" ry="5" fill="#fff"/>
    <path d="M22 60 L10 58 M22 66 L11 70 M78 60 L90 58 M78 66 L89 70" stroke="#2a211c" stroke-width="2"/>`),
  DEFUSE: ()=>svgWrap(`
    <path d="M8 78 Q30 70 46 78 T88 74" stroke="#ff5233" stroke-width="5"/>
    <path d="M46 78 L58 66 M46 70 L58 82" stroke="#8a97a8" stroke-width="5"/>
    <circle cx="60" cy="63" r="5" fill="#fff6e8" stroke="#2a211c" stroke-width="3"/>
    <circle cx="60" cy="85" r="5" fill="#fff6e8" stroke="#2a211c" stroke-width="3"/>
    ${catHead(48,34,26,'#58b368','zen')}`),
  ATTACK: ()=>svgWrap(`
    ${star(76,26,16,'#ffc53d')}
    <text x="76" y="31" font-family="Bangers, sans-serif" font-size="12" fill="#2a211c" text-anchor="middle" stroke="none">POW</text>
    ${catHead(44,46,27,'#9b7ede','angry')}
    <ellipse cx="26" cy="82" rx="12" ry="9" fill="#9b7ede" stroke="#2a211c" stroke-width="3"/>
    <ellipse cx="62" cy="82" rx="12" ry="9" fill="#9b7ede" stroke="#2a211c" stroke-width="3"/>
    <path d="M22 80 L22 86 M28 79 L28 86 M58 80 L58 86 M64 79 L64 86" stroke="#2a211c" stroke-width="2"/>`),
  SKIP: ()=>svgWrap(`
    <path d="M6 40 L26 40 M2 52 L22 52 M8 64 L26 64" stroke="#3fb0d8" stroke-width="4"/>
    ${catHead(58,44,26,'#3fb0d8','scared')}
    <ellipse cx="52" cy="82" rx="16" ry="8" fill="#3fb0d8" stroke="#2a211c" stroke-width="3"/>
    <path d="M38 86 Q30 92 24 86 M66 86 Q74 92 80 86" stroke="#2a211c" stroke-width="3"/>
    <path d="M84 24 Q92 30 86 38" stroke="#2a211c" stroke-width="3"/>`),
  FAVOR: ()=>svgWrap(`
    ${catHead(50,44,28,'#ff8fb5','plead')}
    <ellipse cx="34" cy="82" rx="8" ry="10" fill="#ff8fb5" stroke="#2a211c" stroke-width="3"/>
    <ellipse cx="66" cy="82" rx="8" ry="10" fill="#ff8fb5" stroke="#2a211c" stroke-width="3"/>
    <path d="M83 12 a5 5 0 0 1 10 0 q0 5 -10 11 q-10 -6 -10 -11 a5 5 0 0 1 10 0" fill="#ff5233" stroke="#2a211c" stroke-width="2.5" transform="rotate(12 83 18)"/>`),
  SHUFFLE: ()=>svgWrap(`
    <rect x="8" y="26" width="24" height="34" rx="4" fill="#fff6e8" stroke="#2a211c" stroke-width="3" transform="rotate(-18 20 43)"/>
    <rect x="68" y="24" width="24" height="34" rx="4" fill="#fff6e8" stroke="#2a211c" stroke-width="3" transform="rotate(16 80 41)"/>
    <rect x="38" y="10" width="24" height="34" rx="4" fill="#fff6e8" stroke="#2a211c" stroke-width="3" transform="rotate(4 50 27)"/>
    <path d="M14 78 Q28 64 46 74 M86 80 Q72 62 54 72" stroke="#ffc53d" stroke-width="4"/>
    <path d="M46 74 l-8 -2 m8 2 l-3 7 M54 72 l8 -1 m-8 1 l2 8" stroke="#ffc53d" stroke-width="4"/>
    ${catHead(50,72,20,'#ffc53d','scared')}`),
  FUTURE: ()=>svgWrap(`
    ${catHead(50,32,22,'#9b7ede','zen',`<circle cx="50" cy="14" r="4" fill="#ffc53d" stroke="#2a211c" stroke-width="2"/>`)}
    <circle cx="50" cy="76" r="19" fill="#cdeffb" stroke="#2a211c" stroke-width="3"/>
    <circle cx="43" cy="70" r="4" fill="#fff"/>
    <circle cx="44" cy="78" r="3" fill="#3fb0d8"/><circle cx="52" cy="74" r="3" fill="#ff5233"/><circle cx="58" cy="80" r="3" fill="#ffc53d"/>
    <path d="M31 92 Q50 98 69 92" stroke="#2a211c" stroke-width="3"/>
    <path d="M14 30 l4 0 m-2 -2 l0 4 M84 44 l5 0 m-2.5 -2.5 l0 5" stroke="#ffc53d" stroke-width="2.5"/>`),
  NOPE: ()=>svgWrap(`
    <path d="M30 96 L30 62 Q30 40 50 40 Q70 40 70 62 L70 96" fill="#ffc53d" stroke="#2a211c" stroke-width="3.5"/>
    <path d="M38 46 Q36 34 42 32 M50 42 Q50 30 56 30 M62 46 Q64 34 58 32" stroke="#2a211c" stroke-width="3"/>
    <ellipse cx="50" cy="70" rx="11" ry="8" fill="#ffb1c9" stroke="#2a211c" stroke-width="2.5"/>
    <rect x="12" y="4" width="76" height="28" rx="10" fill="#fff" stroke="#2a211c" stroke-width="3.5" transform="rotate(-4 50 18)"/>
    <text x="50" y="26" font-family="Bangers, sans-serif" font-size="21" fill="#ff5233" text-anchor="middle" stroke="none" transform="rotate(-4 50 18)">NOPE!</text>`),
  CAT_SAMOSA: ()=>svgWrap(`
    <path d="M50 16 L88 84 L12 84 Z" fill="#e8a33d" stroke="#2a211c" stroke-width="3.5"/>
    <path d="M50 16 L88 84 M50 16 L12 84" stroke="#c77f22" stroke-width="3" stroke-dasharray="2 7"/>
    <path d="M26 84 Q30 76 36 84 Q42 76 48 84 Q54 76 60 84 Q66 76 72 84" stroke="#2a211c" stroke-width="3" fill="none"/>
    ${catHead(50,58,17,'#f4c98a','happy')}`),
  CAT_DISCO: ()=>svgWrap(`
    <circle cx="50" cy="20" r="13" fill="#cfd8e3" stroke="#2a211c" stroke-width="3"/>
    <path d="M39 15 L61 15 M39 25 L61 25 M45 8 L45 32 M55 8 L55 32" stroke="#8a97a8" stroke-width="2"/>
    <path d="M50 33 L50 38" stroke="#2a211c" stroke-width="3"/>
    ${catHead(50,64,26,'#ff8fb5','smug',`
      <rect x="30" y="52" width="17" height="10" rx="4" fill="#2a211c"/>
      <rect x="53" y="52" width="17" height="10" rx="4" fill="#2a211c"/>
      <path d="M47 56 L53 56 M30 55 L24 52 M70 55 L76 52" stroke="#2a211c" stroke-width="3"/>`)}
    <path d="M12 34 l5 0 m-2.5 -2.5 l0 5 M86 60 l5 0 m-2.5 -2.5 l0 5 M16 74 l4 0 m-2 -2 l0 4" stroke="#ffc53d" stroke-width="2.5"/>`),
  CAT_PICKLE: ()=>svgWrap(`
    <path d="M50 22 Q76 22 74 54 Q72 88 50 88 Q28 88 26 54 Q24 22 50 22" fill="#58b368" stroke="#2a211c" stroke-width="3.5"/>
    <circle cx="38" cy="60" r="3" fill="#3e8a4c"/><circle cx="60" cy="52" r="3" fill="#3e8a4c"/><circle cx="46" cy="76" r="3" fill="#3e8a4c"/><circle cx="62" cy="72" r="2.5" fill="#3e8a4c"/>
    ${catHead(50,38,17,'#8fd19b','scared')}`),
  CAT_MELON: ()=>svgWrap(`
    <path d="M14 46 A38 38 0 0 1 86 46 L50 46 Z" fill="#ff6b81" stroke="#2a211c" stroke-width="3.5"/>
    <path d="M14 46 A38 38 0 0 1 86 46" stroke="#58b368" stroke-width="7" fill="none"/>
    <circle cx="36" cy="32" r="2.5" fill="#2a211c"/><circle cx="52" cy="24" r="2.5" fill="#2a211c"/><circle cx="66" cy="33" r="2.5" fill="#2a211c"/>
    ${catHead(50,68,22,'#8fd19b','happy')}`),
  CAT_JALEBI: ()=>svgWrap(`
    <g stroke="#e8760c" stroke-width="7" fill="none">
      <circle cx="36" cy="62" r="12"/><circle cx="64" cy="62" r="12"/>
      <circle cx="50" cy="50" r="12"/><circle cx="50" cy="74" r="11"/>
    </g>
    <g stroke="#ffb038" stroke-width="2.5" fill="none">
      <circle cx="36" cy="62" r="12"/><circle cx="64" cy="62" r="12"/><circle cx="50" cy="50" r="12"/>
    </g>
    <path d="M22 40 l4 0 m-2 -2 l0 4 M78 44 l5 0 m-2.5 -2.5 l0 5 M70 84 l4 0 m-2 -2 l0 4" stroke="#fff6e8" stroke-width="2.5"/>
    ${catHead(50,26,15,'#f7c873','happy')}`),
  CAT_LUNGI: ()=>svgWrap(`
    <path d="M28 58 L72 58 L80 96 L20 96 Z" fill="#3fb0d8" stroke="#2a211c" stroke-width="3.5"/>
    <path d="M38 58 L34 96 M50 58 L50 96 M62 58 L66 96" stroke="#2a7f9e" stroke-width="2.5"/>
    <path d="M24 72 L76 72 M22 84 L78 84" stroke="#2a7f9e" stroke-width="2.5"/>
    <path d="M26 58 L74 58" stroke="#2a211c" stroke-width="6"/>
    <path d="M60 56 q10 -6 12 4 q-8 2 -12 -4" fill="#fff6e8" stroke="#2a211c" stroke-width="2.5"/>
    ${catHead(50,34,20,'#c9a06c','smug')}`),
  CAT_CHAI: ()=>svgWrap(`
    <path d="M30 52 L36 90 Q50 96 64 90 L70 52 Z" fill="#d9a066" stroke="#2a211c" stroke-width="3.5"/>
    <path d="M30 52 L70 52" stroke="#fff6e8" stroke-width="5"/>
    <path d="M38 34 q-8 -8 0 -16 q8 -8 0 -14 M50 32 q-8 -8 0 -16 q8 -8 0 -14 M62 34 q-8 -8 0 -16 q8 -8 0 -14"
      stroke="#fff6e8" stroke-width="3" opacity=".85"/>
    ${catHead(50,66,17,'#f0c8a0','zen')}`),
  CAT_RICKSHAW: ()=>svgWrap(`
    <circle cx="30" cy="76" r="17" fill="none" stroke="#2a211c" stroke-width="4"/>
    <circle cx="30" cy="76" r="3" fill="#2a211c"/>
    <path d="M30 60 L30 92 M14 76 L46 76 M19 65 L41 87 M41 65 L19 87" stroke="#8a97a8" stroke-width="2"/>
    <path d="M48 84 L84 84 L84 62 Q66 52 48 62 Z" fill="#ff5233" stroke="#2a211c" stroke-width="3.5"/>
    <path d="M48 62 Q66 52 84 62" stroke="#fff6e8" stroke-width="3"/>
    <circle cx="72" cy="88" r="9" fill="none" stroke="#2a211c" stroke-width="3.5"/>
    ${catHead(42,42,16,'#c9a06c','happy')}`),
  CAT_UNCLE: ()=>svgWrap(`
    <path d="M18 88 L18 58 Q50 40 82 58 L82 88 Z" fill="#ffc53d" stroke="#2a211c" stroke-width="3.5"/>
    <path d="M18 58 Q50 40 82 58 L82 68 Q50 52 18 68 Z" fill="#2a211c"/>
    <circle cx="30" cy="90" r="7" fill="none" stroke="#2a211c" stroke-width="3.5"/>
    <circle cx="70" cy="90" r="7" fill="none" stroke="#2a211c" stroke-width="3.5"/>
    <path d="M40 76 L60 76" stroke="#2a211c" stroke-width="4"/>
    ${catHead(50,60,17,'#c9a06c','smug',`
      <path d="M50 70 Q42 66 37 70 Q35 66 40 64 Q46 63 50 68 Q54 63 60 64 Q65 66 63 70 Q58 66 50 70" fill="#2a211c"/>`)}
    <path d="M34 46 L66 46 L62 38 L38 38 Z" fill="#ff5233" stroke="#2a211c" stroke-width="3"/>`),
  CAT_TACHE: ()=>svgWrap(`
    ${catHead(50,48,28,'#c9a06c','smug',`
      <path d="M50 66 Q38 60 30 66 Q26 60 34 57 Q44 55 50 62 Q56 55 66 57 Q74 60 70 66 Q62 60 50 66" fill="#2a211c"/>
      <circle cx="63" cy="43" r="8" fill="none" stroke="#2a211c" stroke-width="2.5"/>
      <path d="M63 51 L63 60" stroke="#2a211c" stroke-width="2.5"/>`)}
    <path d="M34 12 L44 20 L50 8 L56 20 L66 12 L62 26 L38 26 Z" fill="#ffc53d" stroke="#2a211c" stroke-width="3"/>`),
};
export const CARD_BACK_ART=()=>svgWrap(`
  <circle cx="50" cy="56" r="17" fill="#ffc53d"/>
  <ellipse cx="32" cy="34" rx="7" ry="9" fill="#ffc53d" transform="rotate(-16 32 34)"/>
  <ellipse cx="50" cy="28" rx="7" ry="9" fill="#ffc53d"/>
  <ellipse cx="68" cy="34" rx="7" ry="9" fill="#ffc53d" transform="rotate(16 68 34)"/>`);
export const HERO_ART=()=>svgWrap(`
  ${star(50,52,48,'#ff5233')}${star(50,52,36,'#ffc53d')}
  ${catHead(50,54,26,'#fff6e8','scared')}
  <path d="M50 22 Q46 12 56 8" stroke="#2a211c" stroke-width="3.5"/>${star(58,6,7,'#ffc53d')}`,'0 0 100 100');