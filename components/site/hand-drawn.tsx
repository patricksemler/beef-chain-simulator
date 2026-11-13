/**
 * Hand-drawn graphics for the Aggie look: a pen-wobble filter that charts and
 * sketches opt into with `filter: url(#hand-drawn)`, the steer-head mark, and
 * the pasture-to-meat-case sketch on the landing page.
 *
 * Everything strokes with `currentColor` or theme variables, so the drawings
 * follow light and dark mode without their own palette.
 */

/** Rendered once in the root layout; the filters are referenced from CSS. */
export function HandDrawnFilters() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute' }}
    >
      <defs>
        {/* A light wobble, for chart lines that must stay readable. */}
        <filter id="hand-drawn" x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="2.6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        {/* A looser wobble for illustrations. */}
        <filter id="hand-sketch" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="3"
            seed="3"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

/** A front-facing steer head, drawn as one would on a napkin. */
export function SteerMark({ className }: { className?: string }) {
  return (
    <svg
      className={className ? `steer-mark ${className}` : 'steer-mark'}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <SteerShape />
    </svg>
  );
}

/** A cow facing right, feet on y = 130. Reused at smaller scale for the calf. */
function Cow() {
  return (
    <>
      <path
        className="sketch-wash"
        d="M54 80q-2-14 14-15l44-1q8 0 12 8l2 18q-2 8-12 8l-52 1q-12 0-12-11z"
        transform="translate(4 3)"
      />
      <path d="M50 78q-2-14 14-15l48-1q8 0 12 8l2 20q-2 8-12 8l-52 1q-12 0-12-11z" />
      <path d="m122 66 12-8q8-2 12 4l4 14q0 6-6 6h-8q-6-2-8-8" />
      <path d="m134 58-3-7m9 6 4-6m-12 11-8-2" />
      <path
        className="sketch-ink"
        d="M78 66q12-2 14 8-4 10-14 6-6-8 0-14zm22 10q8-1 9 6-3 7-10 4-4-5 1-10z"
      />
      <path d="M60 98l-1 30m11-29 1 29m33-30-1 30m12-31 2 31" />
      <path d="M50 76q-8 10-5 28" />
      <circle cx="141" cy="66" r="1.2" className="sketch-ink" />
    </>
  );
}

function Grass({ x }: { x: number }) {
  return <path d={`M${x} 130l-3-9m3 9 1-11m-1 11 5-8`} />;
}

/**
 * The chain drawn as places, one vignette per ledger column below it, joined
 * by a dashed trail that ends in an arrow at the meat case.
 */
export function ChainSketch() {
  const places = [
    'pasture',
    'wheat pasture',
    'feedyard',
    'packing plant',
    'meat case',
  ];
  return (
    <svg
      className="chain-sketch"
      viewBox="0 0 1000 196"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <g className="chain-sketch-art">
        {/* Cow-calf: a cow and her calf on grass. */}
        <g transform="translate(-6 0)">
          <Cow />
          <g transform="translate(118 58) scale(.55)">
            <Cow />
          </g>
          <path d="M12 130h184" />
          <Grass x={30} />
          <Grass x={186} />
        </g>

        {/* Stocker: a round bale and a windmill. */}
        <g transform="translate(200 0)">
          <path className="sketch-wash" d="M58 84h44q14 22 0 46H58z" />
          <circle cx="56" cy="106" r="24" />
          <path d="M56 82h46q14 24 0 48H56" />
          <path d="M56 106c0-4 6-4 6 0 0 8-12 8-12 0 0-12 18-12 18 0 0 14-24 16-24 0" />
          <path d="m140 130 12-84 12 84m-20-30h16m-14-24h12" />
          <circle cx="152" cy="42" r="2" />
          <path d="M152 42V22m0 20 18-6m-18 6 14 14m-14-14-14 14m14-14-18-6m18 6h22l8-8v16l-8-8" />
          <path d="M8 130h186" />
          <Grass x={20} />
          <Grass x={118} />
        </g>

        {/* Feedlot: a steer looking over the fence at the bunk. */}
        <g transform="translate(400 0)">
          <g transform="translate(64 40) scale(2.3)" strokeWidth=".85">
            <SteerShape />
          </g>
          <path d="M24 130V84m50 46V84m50 46V84m50 46V84" />
          <path d="M18 96h162M18 112h162" />
          <path className="sketch-wash" d="M42 116h120l-6 14H48z" />
          <path d="M38 114h128l-8 16H46z" />
          <path d="M8 130h186" />
        </g>

        {/* Packer: a sawtooth-roof plant with a stack. */}
        <g transform="translate(600 0)">
          <path
            className="sketch-wash"
            d="M30 78l36-16v16l36-16v16l36-16v68H30z"
          />
          <path d="M24 130V74l38-20v20l38-20v20l38-20v76" />
          <path d="M150 130V40h12v90" />
          <path d="M156 32q-6-6 0-10t2-10m10 10q6-4 4-10" />
          <path d="M60 130v-26h28v26M36 92h12v10H36zm76 0h12v10h-12z" />
          <path d="M8 130h186" />
        </g>

        {/* Retail: a T-bone with a price tag. */}
        <g transform="translate(800 0)">
          <path
            className="sketch-meat"
            d="M38 96q-4-26 32-28 44-4 62 16 16 20-8 36-32 16-62 6-22-8-24-30z"
          />
          <path d="M34 92q-4-26 32-28 44-4 62 16 16 20-8 36-32 16-62 6-22-8-24-30z" />
          <path d="M46 92q0-16 22-18" />
          <path d="M60 82q30-6 58 0M89 80l2 40" strokeWidth="3" />
          <path d="m150 58 30 10-8 26-30-10z" />
          <circle cx="170" cy="70" r="2" />
          <path d="M170 68q-10-20-30-14" />
          <path d="M8 130h186" />
        </g>
      </g>

      {/* The trail from pasture to plate. */}
      <path
        className="chain-sketch-trail"
        d="M24 150q90 12 180 0t200 0 200 0 200 0 150-2"
      />
      <path className="chain-sketch-trail-head" d="m942 140 14 8-14 10" />
      {places.map((place, index) => (
        <text
          key={place}
          className="chain-sketch-label"
          x={100 + index * 200}
          y="188"
        >
          {place}
        </text>
      ))}
    </svg>
  );
}

/** The steer head's strokes without an <svg>, so sketches can nest it. */
function SteerShape() {
  return (
    <>
      <path d="M11.4 10.2C8.6 10 4.6 8.8 2.6 4.6" />
      <path d="M20.6 10.2c2.8-.2 6.8-1.4 8.8-5.6" />
      <path
        className="sketch-face"
        d="M11 10.6c1.6-1.6 8.4-1.6 10 0l-.6 9.6c-.4 4.6-8.4 4.6-8.8 0z"
      />
      <path d="M11.2 12.6 6.8 13.4l4.6 2.2" />
      <path d="m20.8 12.6 4.4.8-4.6 2.2" />
      <path d="M13.6 22.4h4.8" />
      <circle cx="13.8" cy="14.6" r=".5" className="sketch-ink" />
      <circle cx="18.2" cy="14.6" r=".5" className="sketch-ink" />
    </>
  );
}
