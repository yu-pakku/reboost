import { useId, useState, type CSSProperties } from 'react';
import { crystalDrift, type CrystalPlacement } from '@/domain/brain';

export type BrainCrystal = CrystalPlacement & { id: string; entering?: boolean; decorative?: boolean };

export function BrainArt({ description, crystals, onAnimationEnd }: {
  description: string;
  crystals: readonly BrainCrystal[];
  onAnimationEnd?: React.AnimationEventHandler<SVGSVGElement>;
}) {
  const id = useId();
  return <svg className="brain-svg" viewBox="0 0 400 234" role="img"
    aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`} onAnimationEnd={onAnimationEnd}>
    <title id={`${id}-title`}>脳型の知識容器</title>
    <desc id={`${id}-desc`}>{description}</desc>
    <defs>
      <linearGradient id={`${id}-ribbon-back-fill`} x1=".37" y1=".04" x2=".75" y2=".86">
        <stop stopColor="#fff" stopOpacity=".08"/>
        <stop offset=".24" stopColor="#edfaff" stopOpacity=".58"/>
        <stop offset=".62" stopColor="#c3f0f8" stopOpacity=".65"/>
        <stop offset="1" stopColor="#f4fcff" stopOpacity=".28"/>
      </linearGradient>
      <linearGradient id={`${id}-ribbon-crest-fill`} x1=".57" y1=".03" x2=".28" y2=".94">
        <stop stopColor="#a6e6f3" stopOpacity=".55"/>
        <stop offset=".40" stopColor="#dcf6fb" stopOpacity=".51"/>
        <stop offset=".69" stopColor="#fbfeff" stopOpacity=".8"/>
        <stop offset="1" stopColor="#9fe8f6" stopOpacity=".63"/>
      </linearGradient>
      <linearGradient id={`${id}-ribbon-sweep-fill`} x1=".36" y1=".02" x2=".70" y2=".95">
        <stop stopColor="#b0eaf6" stopOpacity=".62"/>
        <stop offset=".36" stopColor="#d4f3fa" stopOpacity=".60"/>
        <stop offset=".58" stopColor="#fcfeff" stopOpacity=".70"/>
        <stop offset=".82" stopColor="#e7f7fb" stopOpacity=".56"/>
        <stop offset="1" stopColor="#9ee3f4" stopOpacity=".70"/>
      </linearGradient>
      <linearGradient id={`${id}-ribbon-return-fill`} x1=".68" y1=".04" x2=".21" y2="1">
        <stop stopColor="#7ed8ee" stopOpacity=".67"/>
        <stop offset=".30" stopColor="#b2e8f5" stopOpacity=".66"/>
        <stop offset=".67" stopColor="#ecf9fd" stopOpacity=".58"/>
        <stop offset="1" stopColor="#f5fcfe" stopOpacity="0"/>
      </linearGradient>
      <linearGradient id={`${id}-ribbon-edge`}>
        <stop stopColor="#6ecfe5" stopOpacity=".05"/>
        <stop offset=".29" stopColor="#78d8eb" stopOpacity=".63"/>
        <stop offset=".65" stopColor="#46b6d3" stopOpacity=".52"/>
        <stop offset="1" stopColor="#94dded" stopOpacity=".04"/>
      </linearGradient>
      <linearGradient id={`${id}-tile-glass-fill`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#effcff" stopOpacity=".78"/>
        <stop offset=".56" stopColor="#8cd9ec" stopOpacity=".43"/>
        <stop offset="1" stopColor="#54afcd" stopOpacity=".36"/>
      </linearGradient>
      <g id={`${id}-ribbon-back`}>
        <path d="M62 106C87 76 113 80 137 57C170 25 205 18 240 28C298 29 346 70 353 110C362 160 319 183 268 164C234 151 222 118 177 114C137 111 113 138 80 133C62 130 53 118 62 106Z" fill={`url(#${id}-ribbon-back-fill)`}/>
        <path d="M96 80C123 67 133 59 148 46C184 17 233 15 269 35C301 53 317 78 314 108" fill="none" stroke={`url(#${id}-ribbon-edge)`} strokeWidth="1.15"/>
      </g>
      <g id={`${id}-ribbon-crest`}>
        <path d="M36 148C17 112 53 77 97 79C131 79 156 87 193 58C220 37 231 22 254 25C303 27 344 60 349 102C352 124 334 142 310 148C328 127 324 110 305 94C280 74 249 67 223 76C182 91 161 120 117 127C78 133 48 137 41 161C39 157 37 152 36 148Z" fill={`url(#${id}-ribbon-crest-fill)`}/>
        <path d="M36 144C41 117 64 99 89 93M114 127C168 119 181 91 223 76C251 66 282 77 301 91" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="1.15" strokeLinecap="round"/>
        <path d="M38 151C53 126 95 133 132 115C168 98 188 64 224 39C237 30 245 27 254 25" fill="none" stroke={`url(#${id}-ribbon-edge)`} strokeWidth="1.05"/>
      </g>
      <g id={`${id}-ribbon-sweep`}>
        <path d="M57 164C63 135 107 133 144 118C182 103 207 78 252 72C295 65 333 77 354 96C374 115 371 141 354 158C332 179 300 181 269 175C226 166 203 164 169 176C131 189 93 200 69 188C59 183 53 174 57 164Z" fill={`url(#${id}-ribbon-sweep-fill)`}/>
        <path d="M57 164C67 136 106 134 144 118C187 100 212 78 252 72C299 65 335 78 355 98C373 117 368 139 356 154" fill="none" stroke={`url(#${id}-ribbon-edge)`} strokeWidth="1.25"/>
        <path d="M61 180C84 204 131 189 169 176C202 165 229 166 269 175" fill="none" stroke={`url(#${id}-ribbon-edge)`} strokeWidth="1.1"/>
        <path d="M200 94C233 79 258 76 288 79" fill="none" stroke="#fff" strokeOpacity=".73" strokeWidth="1.45" strokeLinecap="round"/>
      </g>
      <g id={`${id}-ribbon-return`}>
        <path d="M93 191C128 191 161 170 194 165C230 160 261 178 304 172C265 182 247 201 235 224L204 224C207 201 193 189 176 186C149 180 127 193 93 191Z" fill={`url(#${id}-ribbon-return-fill)`}/>
        <path d="M212 222C226 190 256 176 292 174" fill="none" stroke={`url(#${id}-ribbon-edge)`} strokeWidth="1.15"/>
      </g>
      <g id={`${id}-glass-tile`}>
        <rect x="-6.4" y="-6.4" width="12.8" height="12.8" rx="2.9" fill={`url(#${id}-tile-glass-fill)`} stroke="#459ab5" strokeOpacity=".53" strokeWidth=".8"/>
        <path d="M-4.6-.2v-2c0-1.5.8-2.3 2.3-2.3h2.7" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth=".95" strokeLinecap="round"/>
      </g>
    </defs>
    <g transform="translate(0 117) scale(1 1.06) translate(0 -117)">
      <g className="brain-float">
        <g className="ribbon-object">
          <use className="ribbon-sway ribbon-sway-back" href={`#${id}-ribbon-back`}/>
          <use className="ribbon-sway ribbon-sway-crest" href={`#${id}-ribbon-crest`}/>
          <use className="ribbon-sway ribbon-sway-sweep" href={`#${id}-ribbon-sweep`}/>
          <g aria-hidden="true">{crystals.map(crystal => <Crystal key={crystal.id} assetId={id} {...crystal}/>)}</g>
          <use className="ribbon-sway ribbon-sway-sweep" href={`#${id}-ribbon-return`}/>
        </g>
      </g>
    </g>
  </svg>;
}

function Crystal({ assetId, id, x, y, scale, angle, slot, entering, decorative }: BrainCrystal & { assetId: string }) {
  const [landed, setLanded] = useState(false);
  const motion = crystalDrift(id, slot, scale);
  const style = {
    '--drift-time': `${motion.duration}s`,
    '--drift-phase': entering ? '0s' : `${motion.phase}s`,
    ...Object.fromEntries(motion.points.map(([dx, dy], i) => [`--drift-${i + 1}`, `${dx}px, ${dy}px`])),
    '--entry-x': `${367 - x}px`,
    '--entry-y': `${47 - y}px`,
    '--fold-x': `${310 - x}px`,
    '--fold-y': `${85 - y}px`,
    '--entry-delay': decorative ? `${slot * 135}ms` : '0ms',
    '--tap-delay': `${(slot % 6) * 17}ms`,
    '--tilt': slot % 2 ? '4deg' : '-4deg',
    '--nudge': slot % 2 ? '1px' : '-1px',
  } as CSSProperties;
  return <g data-particle-id={decorative ? undefined : id} data-crystal-position={`${x},${y}`}
    transform={`translate(${x} ${y})`} style={style} className={decorative ? 'sample-particle' : undefined}>
    <g className="tile-drift"><g className="tile-bump">
      <g className={entering && !landed ? 'tile-enter particle-added' : 'tile-enter'}
        onAnimationEnd={event => { if (event.animationName === 'enter') setLanded(true); }}>
        <use href={`#${assetId}-glass-tile`} transform={`rotate(${angle}) scale(${scale})`}/>
      </g>
    </g></g>
  </g>;
}
