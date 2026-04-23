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
const HEAT_SOFT = "#e8c2b1";
const COOL = "#3a6d7a";
const COOL_SOFT = "#bcd4d9";

// Demo sequence to showcase the model learning
const DEMO_SEQ = [
  { Tout: 28, setpoint: 25 },
  { Tout: 30, setpoint: 24 },
  { Tout: 32, setpoint: 23.5 },
  { Tout: 34, setpoint: 23 },
  { Tout: 31, setpoint: 24 },
  { Tout: 35, setpoint: 22.5 },
  { Tout: 29, setpoint: 24.5 },
];

export default function App() {
  const [tout, setTout] = useState(30);
  const [setpoint, setSetpoint] = useState(24);
  const [history, setHistory] = useState([]);
  const [errorsMatrix, setErrorsMatrix] = useState([]);
  const [bestIdx, setBestIdx] = useState(null);
  const [justRecorded, setJustRecorded] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const demoIdxRef = useRef(0);

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

  // Live prediction using the currently selected model
  const livePrediction = useMemo(() => {
    if (bestIdx === null) return null;
    const m = MODELS[bestIdx];
    return tout * m.s + m.i;
  }, [tout, bestIdx]);

  function submit(toutVal, spVal) {
    if (toutVal < CUTOFF) return;
    const sp = Math.max(17, Math.min(29, spVal));

    // What the model WOULD have predicted before seeing this point
    const predictedValue =
      bestIdx !== null
        ? toutVal * MODELS[bestIdx].s + MODELS[bestIdx].i
        : null;

    // New errors column: squared error of every model on this observation
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

    // Boost weights for past observations at similar outdoor temperatures
    const allTouts = [...history.map((h) => h.Tout), toutVal];
    const similarIdx = [];
    for (let k = 0; k < allTouts.length; k++) {
      if (Math.abs(allTouts[k] - toutVal) < THRESHOLD) similarIdx.push(k);
    }
    if (similarIdx.length > 0) {
      for (let k = 0; k < similarIdx.length; k++) {
        const idx = similarIdx[k];
        const newW = ALPHA ** (similarIdx.length - 1 - k);
        weights[idx] = Math.max(weights[idx], newW);
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
      },
    ]);

    setJustRecorded(true);
    setTimeout(() => setJustRecorded(false), 700);
  }

  function handleSubmit() {
    submit(tout, setpoint);
  }

  function reset() {
    setHistory([]);
    setErrorsMatrix([]);
    setBestIdx(null);
    setDemoRunning(false);
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
      submit(step.Tout, step.setpoint);
      demoIdxRef.current += 1;
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [demoRunning, history.length]);

  // Stats
  const stats = useMemo(() => {
    const withPred = history.filter((h) => h.predicted !== null);
    const errs = withPred.map((h) => Math.abs(h.predicted - h.setpoint));
    const mean = errs.length
      ? errs.reduce((a, b) => a + b, 0) / errs.length
      : null;
    return { mean, count: history.length, predCount: withPred.length };
  }, [history]);

  const currentModel = bestIdx !== null ? MODELS[bestIdx] : null;

  // Chart data
  const chartData = history.map((h) => ({
    step: h.step,
    actual: h.setpoint,
    predicted: h.predicted,
  }));

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
        .grain {
          position: relative;
        }
        .grain::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.035;
          background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");
        }
        .pulse-check {
          animation: pulse 0.7s ease-out;
        }
        @keyframes pulse {
          0% { transform: scale(0.6); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="max-w-md mx-auto px-5 py-8 sm:py-10">
        {/* Header */}
        <header className="mb-8">
          <div
            className="text-xs tracking-widest mb-3 uppercase"
            style={{ fontFamily: monoStack, color: MUTED, letterSpacing: "0.22em" }}
          >
            online learning · v1
          </div>
          <h1
            style={{
              fontFamily: fontStack,
              fontWeight: 400,
              fontSize: "2.4rem",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontStyle: "italic",
            }}
          >
            thermal<br/>
            <span style={{ color: HEAT, fontStyle: "normal", fontWeight: 500 }}>comfort</span>
          </h1>
          <div
            className="mt-4 text-sm"
            style={{ color: MUTED, lineHeight: 1.55, maxWidth: "28ch" }}
          >
            A model that learns your air-conditioning preferences by watching what you set.
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
          {/* Outdoor temperature */}
          <div className="mb-7">
            <div className="flex items-baseline justify-between mb-1">
              <label
                className="text-xs uppercase"
                style={{ fontFamily: monoStack, color: MUTED, letterSpacing: "0.16em" }}
              >
                outdoor temp
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

          {/* Model's live prediction */}
          <div
            className="rounded-xl p-4 mb-7 flex items-center justify-between"
            style={{
              background: `linear-gradient(135deg, ${COOL_SOFT}40, transparent)`,
              border: `1px dashed ${COOL}60`,
            }}
          >
            <div>
              <div
                className="text-xs mb-1 uppercase"
                style={{ fontFamily: monoStack, color: MUTED, letterSpacing: "0.16em" }}
              >
                model guess
              </div>
              <div
                style={{
                  fontFamily: fontStack,
                  fontSize: "1.4rem",
                  color: livePrediction === null ? MUTED : COOL,
                  fontStyle: livePrediction === null ? "italic" : "normal",
                  fontWeight: 500,
                }}
              >
                {livePrediction === null
                  ? "awaiting first reading"
                  : `${livePrediction.toFixed(1)}°c`}
              </div>
            </div>
            <Sparkles size={18} style={{ color: COOL, opacity: 0.6 }} />
          </div>

          {/* Your setpoint */}
          <div className="mb-6">
            <div className="flex items-baseline justify-between mb-1">
              <label
                className="text-xs uppercase"
                style={{ fontFamily: monoStack, color: MUTED, letterSpacing: "0.16em" }}
              >
                your setpoint
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
              "record reading"
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

          {history.length === 0 ? (
            <div
              className="text-center py-12"
              style={{
                fontFamily: fontStack,
                fontStyle: "italic",
                color: MUTED,
                fontSize: "0.95rem",
              }}
            >
              record a reading to begin
              <div style={{ fontSize: "0.75rem", marginTop: "0.5rem", fontStyle: "normal", fontFamily: monoStack }}>
                or try the demo below ↓
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
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
                    width={38}
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
                    name="your setpoint"
                    stroke={COOL}
                    strokeWidth={2}
                    dot={{ r: 4, fill: COOL, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    name="model guess"
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
            current fit
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
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
            <StatCell
              label="mean err"
              value={
                stats.mean !== null ? `${stats.mean.toFixed(2)}°` : "—"
              }
              mono={monoStack}
              serif={fontStack}
              accent={HEAT}
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
              setpoint ≈ {currentModel.s >= 0 ? "+" : ""}
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
          80 pretrained models · α = {ALPHA} · threshold = {THRESHOLD}°
          <br />
          cooling-mode cutoff ≥ {CUTOFF}°c
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
