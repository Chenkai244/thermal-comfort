import { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { RotateCcw, Sparkles, Check } from "lucide-react";

// 80 pretrained (slope, intercept) pairs from the CSV
const MODELS = [
  {s:-0.024397,i:23.390099},{s:0.018824,i:22.195845},{s:0.028420,i:23.201353},
  {s:-0.006390,i:24.495527},{s:0.028571,i:24.246769},{s:0.330849,i:16.428945},
  {s:-0.004785,i:23.841438},{s:-0.013533,i:25.270885},{s:0.006736,i:23.274097},
  {s:-0.008786,i:24.043403},{s:-0.000134,i:23.339191},{s:0.074769,i:21.371181},
  {s:0.006453,i:23.712049},{s:0.073331,i:22.287627},{s:0.009442,i:22.973514},
  {s:0.058865,i:24.052107},{s:0.025490,i:23.046231},{s:0.082781,i:22.096726},
  {s:-0.332406,i:36.150009},{s:0.041835,i:23.625813},{s:0.039369,i:23.397088},
  {s:0.066105,i:23.318161},{s:-0.006884,i:24.772025},{s:-0.010895,i:24.886748},
  {s:0.041358,i:21.624253},{s:0.037227,i:22.923508},{s:0.007389,i:22.608867},
  {s:-0.007462,i:23.659390},{s:-0.005001,i:24.661957},{s:-0.034434,i:24.235693},
  {s:0.002669,i:24.572839},{s:0.089906,i:20.569853},{s:0.008052,i:22.704254},
  {s:-0.006192,i:24.341640},{s:0.001256,i:23.773442},{s:0.069640,i:22.766425},
  {s:-0.021629,i:26.109650},{s:0.043021,i:23.874529},{s:0.008366,i:23.983948},
  {s:0.021126,i:23.489587},{s:0.023790,i:22.867559},{s:-0.006902,i:23.445774},
  {s:0.035491,i:22.447087},{s:-0.014752,i:23.592089},{s:-0.029930,i:25.929993},
  {s:0.024814,i:23.124809},{s:-0.023592,i:25.785479},{s:0.068738,i:21.043639},
  {s:-0.013697,i:25.126535},{s:-0.073177,i:28.499470},{s:-0.012513,i:26.260697},
  {s:0.185689,i:18.506576},{s:0.122732,i:19.787154},{s:-0.033501,i:26.737215},
  {s:-0.000105,i:24.111749},{s:0.001849,i:22.785277},{s:0.049132,i:23.809708},
  {s:0.048606,i:22.531634},{s:0.051521,i:21.844483},{s:-0.001702,i:24.993209},
  {s:-0.046192,i:27.119944},{s:-0.180622,i:31.019335},{s:-0.033730,i:26.489901},
  {s:0.568369,i:10.355262},{s:-0.007921,i:25.646716},{s:-0.000711,i:25.541946},
  {s:-0.074756,i:25.560492},{s:-0.000118,i:23.930280},{s:0.026631,i:22.017333},
  {s:-0.004647,i:22.289122},{s:-0.091399,i:23.775683},{s:0.016441,i:22.363378},
  {s:0.001751,i:24.423072},{s:0.091933,i:22.631244},{s:0.010724,i:24.165771},
  {s:-0.011550,i:25.416217},{s:-0.059812,i:27.640899},{s:0.034712,i:23.551688},
  {s:0.082889,i:23.706634},{s:0.002050,i:23.891000},
];

// Hyperparameters (from the R script defaults)
const ALPHA = 0.7;
const THRESHOLD = 4;
const CUTOFF = 18;

// Colors
const CREAM = "#f2ebdb";
const PAPER = "#fbf6ea";
const INK = "#2a1f1a";
const MUTED = "#7a6350";
const RULE = "#d6c7ae";
const HEAT = "#b54728";
const COOL = "#3a6d7a";
const COOL_SOFT = "#bcd4d9";
const SKY = "#8a6f3e";
const SKY_SOFT = "#e8dcc0";

// Archetype chart geometry (outdoor-temp vs preferred-setpoint, 80 pre-trained lines)
const AW = 400;
const AH = 260;
const AX_PAD = { left: 52, right: 16, top: 14, bottom: 44 };
const APW = AW - AX_PAD.left - AX_PAD.right;
const APH = AH - AX_PAD.top - AX_PAD.bottom;
const AX_MIN = 18;
const AX_MAX = 45;
const AY_MIN = 15;
const AY_MAX = 30;
const axScale = (x) =>
  AX_PAD.left + ((x - AX_MIN) / (AX_MAX - AX_MIN)) * APW;
const ayScale = (y) =>
  AX_PAD.top + (1 - (y - AY_MIN) / (AY_MAX - AY_MIN)) * APH;
// Precompute the endpoints of every model line so we don't recompute per-render
const MODEL_LINES = MODELS.map((m, idx) => ({
  idx,
  x1: axScale(AX_MIN),
  y1: ayScale(AX_MIN * m.s + m.i),
  x2: axScale(AX_MAX),
  y2: ayScale(AX_MAX * m.s + m.i),
}));

// Demo sequence — each step carries a forecast for the NEXT step's Tout
// (so at step j, the forecast equals T_{j+1} — exactly what the R script peeks at)
const DEMO_SEQ = [
  { Tout: 28, setpoint: 25,   forecast: 30   },
  { Tout: 30, setpoint: 24,   forecast: 32   },
  { Tout: 32, setpoint: 23.5, forecast: 34   },
  { Tout: 34, setpoint: 23,   forecast: 31   },
  { Tout: 31, setpoint: 24,   forecast: 35   },
  { Tout: 35, setpoint: 22.5, forecast: 29   },
  { Tout: 29, setpoint: 24.5, forecast: null },
];

export default function App() {
  const [tout, setTout] = useState(30);
  const [setpoint, setSetpoint] = useState(24);
  const [history, setHistory] = useState([]);
  const [errorsMatrix, setErrorsMatrix] = useState([]);
  const [bestIdx, setBestIdx] = useState(null);
  const [justRecorded, setJustRecorded] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [hoverTout, setHoverTout] = useState(null);
  const [forecastTout, setForecastTout] = useState(""); // string so empty = no forecast
  const demoIdxRef = useRef(0);
  const archetypeSvgRef = useRef(null);

  // Load elegant fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=JetBrains+Mono:wght@400;500;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      try { document.head.removeChild(link); } catch (e) {}
    };
  }, []);

  // Core update step. If boostRef is provided, it replaces toutVal as the
  // reference in the similar-temperature weight boost (R-style lookahead).
  function submit(toutVal, spVal, boostRef = null) {
    if (toutVal < CUTOFF) return;
    const sp = Math.max(17, Math.min(29, spVal));

    // What the model WOULD have predicted before seeing this point
    const predictedValue =
      bestIdx !== null
        ? toutVal * MODELS[bestIdx].s + MODELS[bestIdx].i
        : null;

    // Squared error of every model on this observation
    const newCol = MODELS.map((m) => {
      const pred = toutVal * m.s + m.i;
      return (pred - sp) ** 2;
    });
    const newMatrix = [...errorsMatrix, newCol];
    const nCols = newMatrix.length;

    // Exponentially decaying weights — most recent observation has weight 1
    const weights = Array.from(
      { length: nCols },
      (_, k) => ALPHA ** (nCols - 1 - k)
    );

    // Similar-temperature weight boost — matches new R code exactly.
    // Only applied when a forecast for the NEXT Tout is provided.
    // Without a forecast, we rely on pure alpha decay (no fallback).
    if (boostRef !== null) {
      const allTouts = [...history.map((h) => h.Tout), toutVal];
      const similarIdx = [];
      for (let k = 0; k < allTouts.length; k++) {
        if (Math.abs(allTouts[k] - boostRef) < THRESHOLD) similarIdx.push(k);
      }
      if (similarIdx.length > 0) {
        for (let k = 0; k < similarIdx.length; k++) {
          const idx = similarIdx[k];
          const newW = ALPHA ** (similarIdx.length - 1 - k);
          weights[idx] = Math.max(weights[idx], newW);
        }
      }
    }

    // Weighted RMSE per model — pick the minimum
    let bestScore = Infinity;
    let newBest = 0;
    for (let mIdx = 0; mIdx < MODELS.length; mIdx++) {
      let s = 0;
      for (let k = 0; k < nCols; k++) {
        s += weights[k] * newMatrix[k][mIdx];
      }
      const score = Math.sqrt(s);
      if (score < bestScore) {
        bestScore = score;
        newBest = mIdx;
      }
    }

    setErrorsMatrix(newMatrix);
    setBestIdx(newBest);
    setHistory((h) => [
      ...h,
      {
        step: h.length + 1,
        Tout: toutVal,
        setpoint: sp,
        predicted: predictedValue,
        forecast: boostRef,
      },
    ]);

    setJustRecorded(true);
    setTimeout(() => setJustRecorded(false), 700);
  }

  function handleSubmit() {
    // Parse forecast: empty string / invalid input → null (pure alpha-decay only)
    const parsed = parseFloat(forecastTout);
    const fc = Number.isFinite(parsed) ? parsed : null;
    submit(tout, setpoint, fc);
  }

  function reset() {
    setHistory([]);
    setErrorsMatrix([]);
    setBestIdx(null);
    setDemoRunning(false);
    setForecastTout("");
    demoIdxRef.current = 0;
  }

  function runDemo() {
    if (demoRunning) return;
    reset();
    setDemoRunning(true);
    demoIdxRef.current = 0;
  }

  // Drive demo sequence one step at a time
  useEffect(() => {
    if (!demoRunning) return;
    if (demoIdxRef.current >= DEMO_SEQ.length) {
      setDemoRunning(false);
      return;
    }
    const t = setTimeout(() => {
      const step = DEMO_SEQ[demoIdxRef.current];
      setTout(step.Tout);
      setSetpoint(step.setpoint);
      submit(step.Tout, step.setpoint, step.forecast ?? null);
      demoIdxRef.current += 1;
    }, 750);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [demoRunning, history.length]);

  const currentModel = bestIdx !== null ? MODELS[bestIdx] : null;

  // Chart data — hide the first reading per UI spec
  const chartData = history
    .filter((h) => h.step > 1)
    .map((h) => ({
      step: h.step,
      actual: h.setpoint,
      predicted: h.predicted,
    }));

  // Hover point on the selected archetype line
  const hoverPoint = useMemo(() => {
    if (hoverTout === null || bestIdx === null) return null;
    const m = MODELS[bestIdx];
    const y = hoverTout * m.s + m.i;
    if (y < AY_MIN || y > AY_MAX) return null;
    return { x: hoverTout, y, px: axScale(hoverTout), py: ayScale(y) };
  }, [hoverTout, bestIdx]);

  function handleArchetypeMove(e) {
    if (bestIdx === null) return;
    const svg = archetypeSvgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX);
    if (clientX === undefined) return;
    const relX = ((clientX - rect.left) / rect.width) * AW;
    if (relX < AX_PAD.left || relX > AX_PAD.left + APW) {
      setHoverTout(null);
      return;
    }
    const t = AX_MIN + ((relX - AX_PAD.left) / APW) * (AX_MAX - AX_MIN);
    setHoverTout(Math.max(AX_MIN, Math.min(AX_MAX, t)));
  }

  function handleArchetypeLeave() {
    setHoverTout(null);
  }

  const fontStack = "'Fraunces', Georgia, serif";
  const monoStack = "'JetBrains Mono', ui-monospace, monospace";

  return (
    <div
      style={{
        background: CREAM,
        color: INK,
        fontFamily: fontStack,
        minHeight: "100vh",
        backgroundImage:
          "radial-gradient(ellipse at top, rgba(181,71,40,0.06) 0%, transparent 55%), radial-gradient(ellipse at bottom right, rgba(58,109,122,0.05) 0%, transparent 60%)",
      }}
      className="w-full"
    >
      <style>{`
        input[type=range].thermal-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 3px;
          background: ${RULE};
          border-radius: 999px;
          outline: none;
        }
        input[type=range].thermal-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${PAPER};
          border: 2px solid ${HEAT};
          box-shadow: 0 2px 8px rgba(42,31,26,0.15);
          cursor: pointer;
        }
        input[type=range].thermal-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${PAPER};
          border: 2px solid ${HEAT};
          box-shadow: 0 2px 8px rgba(42,31,26,0.15);
          cursor: pointer;
        }
        input[type=range].thermal-slider.cool::-webkit-slider-thumb { border-color: ${COOL}; }
        input[type=range].thermal-slider.cool::-moz-range-thumb { border-color: ${COOL}; }
        input[type=range].thermal-slider.sky::-webkit-slider-thumb { border-color: ${SKY}; }
        input[type=range].thermal-slider.sky::-moz-range-thumb { border-color: ${SKY}; }
        .grain { position: relative; }
        .grain::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.035;
          background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");
        }
        .pulse-check { animation: pulse 0.7s ease-out; }
        @keyframes pulse {
          0% { transform: scale(0.6); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        input.forecast-input:focus {
          border-color: ${SKY} !important;
          box-shadow: 0 0 0 3px ${SKY_SOFT};
        }
        input.forecast-input::placeholder {
          color: ${MUTED};
          opacity: 0.5;
        }
      `}</style>

      <div className="max-w-md mx-auto px-5 py-8 sm:py-10">
        {/* Header */}
        <header className="mb-8">
          <h1
            style={{
              fontFamily: fontStack,
              fontWeight: 500,
              fontSize: "2.4rem",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: HEAT,
            }}
          >
            ComfortGPT
          </h1>
          <div
            className="mt-4 text-sm"
            style={{ color: MUTED, lineHeight: 1.55, maxWidth: "32ch" }}
          >
            A tool that learns your preferred temperature setpoint.
          </div>
        </header>

        {/* Main card */}
        <div
          className="grain rounded-2xl p-6 mb-5"
          style={{
            background: PAPER,
            border: `1px solid ${RULE}`,
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 20px rgba(42,31,26,0.04)",
          }}
        >
          {/* Your preferred setpoint */}
          <div className="mb-7">
            <div className="flex items-baseline justify-between mb-1">
              <label
                className="text-xs uppercase"
                style={{ fontFamily: monoStack, color: MUTED, letterSpacing: "0.16em" }}
              >
                your preferred setpoint
              </label>
              <span
                className="text-xs"
                style={{ fontFamily: monoStack, color: MUTED }}
              >
                17–29°
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span
                style={{
                  fontFamily: fontStack,
                  fontSize: "4rem",
                  fontWeight: 300,
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  color: COOL,
                }}
              >
                {setpoint.toFixed(1)}
              </span>
              <span
                style={{
                  fontFamily: fontStack,
                  fontSize: "1.6rem",
                  fontWeight: 300,
                  color: COOL,
                  fontStyle: "italic",
                }}
              >
                °c
              </span>
            </div>
            <input
              type="range"
              className="thermal-slider cool"
              min={17}
              max={29}
              step={0.5}
              value={setpoint}
              onChange={(e) => setSetpoint(parseFloat(e.target.value))}
            />
          </div>

          {/* Outdoor temperature */}
          <div className="mb-6">
            <div className="flex items-baseline justify-between mb-1">
              <label
                className="text-xs uppercase"
                style={{ fontFamily: monoStack, color: MUTED, letterSpacing: "0.16em" }}
              >
                outdoor temperature
              </label>
              <span
                className="text-xs"
                style={{ fontFamily: monoStack, color: MUTED }}
              >
                {CUTOFF}–45°
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span
                style={{
                  fontFamily: fontStack,
                  fontSize: "4rem",
                  fontWeight: 300,
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  color: HEAT,
                }}
              >
                {tout.toFixed(1)}
              </span>
              <span
                style={{
                  fontFamily: fontStack,
                  fontSize: "1.6rem",
                  fontWeight: 300,
                  color: HEAT,
                  fontStyle: "italic",
                }}
              >
                °c
              </span>
            </div>
            <input
              type="range"
              className="thermal-slider"
              min={CUTOFF}
              max={45}
              step={0.5}
              value={tout}
              onChange={(e) => setTout(parseFloat(e.target.value))}
            />
          </div>

          {/* Forecast Tout — compact inline input (optional) */}
          <div className="flex items-center justify-between mb-5">
            <div
              style={{
                fontFamily: monoStack,
                fontSize: "0.72rem",
                color: MUTED,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              forecast T<sub style={{ fontSize: "0.6rem" }}>out</sub>
            </div>
            <div className="flex items-baseline gap-1">
              <input
                type="text"
                inputMode="decimal"
                value={forecastTout}
                onChange={(e) => {
                  const v = e.target.value;
                  // Allow empty, digits, and decimal point only
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setForecastTout(v);
                }}
                placeholder="—"
                className="forecast-input"
                style={{
                  fontFamily: fontStack,
                  fontSize: "1.15rem",
                  fontWeight: 400,
                  color: SKY,
                  width: "68px",
                  textAlign: "right",
                  border: `1px solid ${RULE}`,
                  borderRadius: 8,
                  padding: "4px 10px",
                  background: PAPER,
                  outline: "none",
                  letterSpacing: "-0.01em",
                  transition: "border-color 0.15s",
                }}
              />
              <span
                style={{
                  fontFamily: fontStack,
                  fontSize: "0.95rem",
                  fontStyle: "italic",
                  color: SKY,
                  marginLeft: "2px",
                }}
              >
                °c
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={demoRunning}
            className="w-full rounded-xl py-4 flex items-center justify-center gap-2 transition-all active:scale-98"
            style={{
              background: demoRunning ? MUTED : HEAT,
              color: PAPER,
              fontFamily: monoStack,
              fontSize: "0.82rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 500,
              boxShadow: demoRunning ? "none" : "0 6px 20px rgba(181,71,40,0.25)",
              cursor: demoRunning ? "not-allowed" : "pointer",
              border: "none",
            }}
          >
            {justRecorded ? (
              <>
                <Check size={16} className="pulse-check" />
                <span className="pulse-check">recorded</span>
              </>
            ) : (
              "confirm selection"
            )}
          </button>
        </div>

        {/* Chart card */}
        <div
          className="grain rounded-2xl p-5 mb-5"
          style={{
            background: PAPER,
            border: `1px solid ${RULE}`,
          }}
        >
          <div className="flex items-baseline justify-between mb-4">
            <div
              className="text-xs uppercase"
              style={{ fontFamily: monoStack, color: MUTED, letterSpacing: "0.16em" }}
            >
              learning trace
            </div>
            <div
              className="text-xs"
              style={{ fontFamily: monoStack, color: MUTED }}
            >
              {history.length} {history.length === 1 ? "reading" : "readings"}
            </div>
          </div>

          {history.length < 2 ? (
            <div
              className="text-center py-12"
              style={{
                fontFamily: fontStack,
                fontStyle: "italic",
                color: MUTED,
                fontSize: "0.95rem",
              }}
            >
              {history.length === 0
                ? "record a reading to begin"
                : "record one more reading to see the trace"}
              <div style={{ fontSize: "0.75rem", marginTop: "0.5rem", fontStyle: "normal", fontFamily: monoStack }}>
                or try the demo below ↓
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={RULE} strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="step"
                    stroke={MUTED}
                    tick={{ fontFamily: monoStack, fontSize: 11, fill: MUTED }}
                    tickLine={false}
                    axisLine={{ stroke: RULE }}
                  />
                  <YAxis
                    domain={[17, 29]}
                    stroke={MUTED}
                    tick={{ fontFamily: monoStack, fontSize: 11, fill: MUTED }}
                    tickLine={false}
                    axisLine={{ stroke: RULE }}
                    width={54}
                    label={{
                      value: "Setpoint (°C)",
                      angle: -90,
                      position: "insideLeft",
                      offset: 14,
                      style: {
                        fontFamily: monoStack,
                        fontSize: 11,
                        fill: MUTED,
                        letterSpacing: "0.08em",
                        textAnchor: "middle",
                      },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: PAPER,
                      border: `1px solid ${RULE}`,
                      borderRadius: 8,
                      fontFamily: monoStack,
                      fontSize: "0.75rem",
                    }}
                    labelStyle={{ color: INK }}
                    formatter={(v, name) =>
                      v === null || v === undefined ? "—" : [`${v.toFixed(2)}°`, name]
                    }
                    labelFormatter={(l) => `reading ${l}`}
                  />
                  <Legend
                    wrapperStyle={{
                      fontFamily: monoStack,
                      fontSize: "0.7rem",
                      paddingTop: "0.5rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                    }}
                    iconType="line"
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="selected setpoint"
                    stroke={COOL}
                    strokeWidth={2}
                    dot={{ r: 4, fill: COOL, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    name="predicted setpoint"
                    stroke={HEAT}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={{ r: 3, fill: PAPER, stroke: HEAT, strokeWidth: 1.5 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Archetype chart: all 80 pre-trained models, selected one highlighted */}
        <div
          className="grain rounded-2xl p-5 mb-5"
          style={{
            background: PAPER,
            border: `1px solid ${RULE}`,
          }}
        >
          <div className="flex items-baseline justify-between mb-4">
            <div
              className="text-xs uppercase"
              style={{ fontFamily: monoStack, color: MUTED, letterSpacing: "0.16em" }}
            >
              thermal archetypes
            </div>
            <div
              className="text-xs"
              style={{ fontFamily: monoStack, color: MUTED }}
            >
              {bestIdx !== null ? `#${bestIdx + 1} of 80` : "80 pre-trained"}
            </div>
          </div>

          <div style={{ width: "100%" }}>
            <svg
              ref={archetypeSvgRef}
              viewBox={`0 0 ${AW} ${AH}`}
              width="100%"
              preserveAspectRatio="xMidYMid meet"
              onMouseMove={handleArchetypeMove}
              onMouseLeave={handleArchetypeLeave}
              onTouchStart={handleArchetypeMove}
              onTouchMove={handleArchetypeMove}
              onTouchEnd={handleArchetypeLeave}
              style={{
                display: "block",
                cursor: bestIdx !== null ? "crosshair" : "default",
                touchAction: "none",
              }}
            >
              <defs>
                <clipPath id="archetype-plot-clip">
                  <rect
                    x={AX_PAD.left}
                    y={AX_PAD.top}
                    width={APW}
                    height={APH}
                  />
                </clipPath>
              </defs>

              {/* Horizontal grid lines */}
              {[15, 18, 21, 24, 27, 30].map((y) => (
                <line
                  key={`gy-${y}`}
                  x1={AX_PAD.left}
                  y1={ayScale(y)}
                  x2={AX_PAD.left + APW}
                  y2={ayScale(y)}
                  stroke={RULE}
                  strokeDasharray="2 4"
                  strokeWidth={0.8}
                />
              ))}

              {/* All 80 background models in light gray */}
              <g clipPath="url(#archetype-plot-clip)">
                {MODEL_LINES.map((l) =>
                  l.idx === bestIdx ? null : (
                    <line
                      key={`m-${l.idx}`}
                      x1={l.x1}
                      y1={l.y1}
                      x2={l.x2}
                      y2={l.y2}
                      stroke={MUTED}
                      strokeOpacity={0.18}
                      strokeWidth={0.8}
                    />
                  )
                )}
              </g>

              {/* Selected model highlighted in blue */}
              {bestIdx !== null && (
                <g clipPath="url(#archetype-plot-clip)">
                  <line
                    x1={MODEL_LINES[bestIdx].x1}
                    y1={MODEL_LINES[bestIdx].y1}
                    x2={MODEL_LINES[bestIdx].x2}
                    y2={MODEL_LINES[bestIdx].y2}
                    stroke={COOL}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </g>
              )}

              {/* Hover guide lines + marker */}
              {hoverPoint && (
                <g style={{ pointerEvents: "none" }}>
                  <line
                    x1={hoverPoint.px}
                    y1={hoverPoint.py}
                    x2={hoverPoint.px}
                    y2={AX_PAD.top + APH}
                    stroke={COOL}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    opacity={0.75}
                  />
                  <line
                    x1={AX_PAD.left}
                    y1={hoverPoint.py}
                    x2={hoverPoint.px}
                    y2={hoverPoint.py}
                    stroke={COOL}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    opacity={0.75}
                  />
                  <circle
                    cx={hoverPoint.px}
                    cy={hoverPoint.py}
                    r={5}
                    fill={PAPER}
                    stroke={COOL}
                    strokeWidth={2}
                  />
                </g>
              )}

              {/* Y-axis */}
              <line
                x1={AX_PAD.left}
                y1={AX_PAD.top}
                x2={AX_PAD.left}
                y2={AX_PAD.top + APH}
                stroke={RULE}
                strokeWidth={1}
              />
              {/* Y-axis ticks + labels */}
              {[15, 18, 21, 24, 27, 30].map((y) => (
                <g key={`yt-${y}`}>
                  <line
                    x1={AX_PAD.left - 4}
                    y1={ayScale(y)}
                    x2={AX_PAD.left}
                    y2={ayScale(y)}
                    stroke={MUTED}
                    strokeWidth={1}
                  />
                  <text
                    x={AX_PAD.left - 8}
                    y={ayScale(y) + 3.5}
                    textAnchor="end"
                    fontFamily={monoStack}
                    fontSize={10}
                    fill={MUTED}
                  >
                    {y}
                  </text>
                </g>
              ))}
              {/* Y-axis title */}
              <text
                transform={`translate(14, ${AX_PAD.top + APH / 2}) rotate(-90)`}
                textAnchor="middle"
                fontFamily={monoStack}
                fontSize={10}
                fill={MUTED}
                letterSpacing="0.05em"
              >
                Preferred Setpoint (°C)
              </text>

              {/* X-axis */}
              <line
                x1={AX_PAD.left}
                y1={AX_PAD.top + APH}
                x2={AX_PAD.left + APW}
                y2={AX_PAD.top + APH}
                stroke={RULE}
                strokeWidth={1}
              />
              {/* X-axis ticks + labels */}
              {[18, 24, 30, 36, 42].map((x) => (
                <g key={`xt-${x}`}>
                  <line
                    x1={axScale(x)}
                    y1={AX_PAD.top + APH}
                    x2={axScale(x)}
                    y2={AX_PAD.top + APH + 4}
                    stroke={MUTED}
                    strokeWidth={1}
                  />
                  <text
                    x={axScale(x)}
                    y={AX_PAD.top + APH + 15}
                    textAnchor="middle"
                    fontFamily={monoStack}
                    fontSize={10}
                    fill={MUTED}
                  >
                    {x}
                  </text>
                </g>
              ))}
              {/* X-axis title */}
              <text
                x={AX_PAD.left + APW / 2}
                y={AH - 8}
                textAnchor="middle"
                fontFamily={monoStack}
                fontSize={10}
                fill={MUTED}
                letterSpacing="0.05em"
              >
                Outdoor Temperature (°C)
              </text>

              {/* Hover tooltip */}
              {hoverPoint && (() => {
                const tipW = 118;
                const tipH = 36;
                // keep tooltip inside plot area
                let tx = hoverPoint.px + 10;
                if (tx + tipW > AX_PAD.left + APW) tx = hoverPoint.px - tipW - 10;
                let ty = hoverPoint.py - tipH - 8;
                if (ty < AX_PAD.top) ty = hoverPoint.py + 10;
                return (
                  <g
                    transform={`translate(${tx}, ${ty})`}
                    style={{ pointerEvents: "none" }}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={tipW}
                      height={tipH}
                      rx={6}
                      fill={PAPER}
                      stroke={RULE}
                      strokeWidth={1}
                    />
                    <text
                      x={9}
                      y={14}
                      fontFamily={monoStack}
                      fontSize={9}
                      fill={MUTED}
                      letterSpacing="0.04em"
                    >
                      T<tspan dy="2" fontSize={7}>out</tspan>
                      <tspan dy="-2">: {hoverPoint.x.toFixed(1)}°C</tspan>
                    </text>
                    <text
                      x={9}
                      y={28}
                      fontFamily={monoStack}
                      fontSize={9}
                      fill={COOL}
                      fontWeight={600}
                    >
                      Setpoint: {hoverPoint.y.toFixed(1)}°C
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>

          {bestIdx === null && (
            <div
              className="text-center text-xs italic mt-2"
              style={{ fontFamily: fontStack, color: MUTED }}
            >
              confirm a selection to highlight your archetype
            </div>
          )}
          {bestIdx !== null && (
            <div
              className="text-xs italic mt-2 text-center"
              style={{ fontFamily: fontStack, color: MUTED }}
            >
              hover the blue line to read predicted setpoints
            </div>
          )}
        </div>

        {/* Stats card */}
        <div
          className="rounded-2xl p-5 mb-5"
          style={{
            background: "transparent",
            border: `1px solid ${RULE}`,
          }}
        >
          <div
            className="text-xs uppercase mb-4"
            style={{ fontFamily: monoStack, color: MUTED, letterSpacing: "0.16em" }}
          >
            current thermal archetype
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCell
              label="slope"
              value={currentModel ? currentModel.s.toFixed(4) : "—"}
              mono={monoStack}
              serif={fontStack}
            />
            <StatCell
              label="intercept"
              value={currentModel ? currentModel.i.toFixed(2) : "—"}
              mono={monoStack}
              serif={fontStack}
            />
          </div>
          {currentModel && (
            <div
              className="text-xs pt-3 italic"
              style={{
                borderTop: `1px dashed ${RULE}`,
                fontFamily: fontStack,
                color: MUTED,
                lineHeight: 1.5,
              }}
            >
              Predicted setpoint = {currentModel.s >= 0 ? "+" : ""}
              {currentModel.s.toFixed(4)} × T
              <sub>out</sub> + {currentModel.i.toFixed(2)}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 mb-10">
          <button
            onClick={reset}
            className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2"
            style={{
              background: "transparent",
              border: `1px solid ${RULE}`,
              color: MUTED,
              fontFamily: monoStack,
              fontSize: "0.72rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={13} />
            reset
          </button>
          <button
            onClick={runDemo}
            disabled={demoRunning}
            className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2"
            style={{
              background: demoRunning ? RULE : INK,
              color: PAPER,
              fontFamily: monoStack,
              fontSize: "0.72rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: demoRunning ? "not-allowed" : "pointer",
              border: "none",
            }}
          >
            <Sparkles size={13} />
            {demoRunning ? "running…" : "try demo"}
          </button>
        </div>

        {/* Footer note */}
        <div
          className="text-xs text-center pb-4"
          style={{ color: MUTED, fontFamily: fontStack, fontStyle: "italic", lineHeight: 1.6 }}
        >
          80 pretrained archetypes · α = {ALPHA} · threshold = {THRESHOLD}°
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, mono, serif, accent }) {
  return (
    <div>
      <div
        className="text-xs uppercase mb-1"
        style={{ fontFamily: mono, color: "#7a6350", letterSpacing: "0.12em", fontSize: "0.62rem" }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: serif,
          fontSize: "1.25rem",
          fontWeight: 400,
          color: accent || "#2a1f1a",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}
