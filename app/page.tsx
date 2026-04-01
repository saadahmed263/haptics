'use client';

import { useState, useMemo, useRef } from 'react';

// --- THE METRIC JUNK DRAWER ---
const householdItems = [
  { id: 'steel-bottle', name: 'Stainless Steel Water Bottle (1L, Empty)', mass: 250 },
  { id: 'smartphone', name: 'Standard Smartphone', mass: 204 },
  { id: 'tea-cup', name: 'Ceramic Tea Cup', mass: 120 },
  { id: 'parle-g', name: 'Biscuit Packet (approx. 50g)', mass: 50 },
  { id: 'steel-spoon', name: 'Standard Steel Tablespoon', mass: 40 },
  { id: 'battery-aa', name: 'AA Battery', mass: 23 },
  { id: 'eraser', name: 'Non-Dust Eraser', mass: 20 },
  { id: 'battery-aaa', name: 'AAA Battery', mass: 11.5 },
  { id: 'matchbox', name: 'Standard Matchbox', mass: 10 },
  { id: 'pen', name: 'Ballpoint Pen', mass: 7 },
  { id: 'coin-5rs', name: '₹5 Coin', mass: 6.7 },
  { id: 'a4-paper', name: 'A4 Paper (80 GSM)', mass: 5 },
  { id: 'coin-1rs', name: '₹1 Coin', mass: 3.8 },
].sort((a, b) => b.mass - a.mass);

type AssemblyHighlight = {
  label: string;
  xPercent: number;
  yPercent: number;
  hexColor: string;
};

type AnalysisResult = {
  objectCategory: string;
  estimatedMassGrams: number;
  userIntentContext: string;
  primaryVerdictHeading: string;
  primaryVerdictBody: string;
  suggestedJunkSimulations: string;
  assemblyHighlights: AssemblyHighlight[];
  volumeCm3: number;
  visibleMaterial: string;
  confidence: number;
};

// --- MATH ENGINE ---
function calculateRecipe(target: number) {
  let remaining = target;
  const items = [];
  for (const item of householdItems) {
    if (remaining < 0.5) break;
    const count = Math.floor(remaining / item.mass);
    if (count > 0) {
      items.push({ name: item.name, count, totalMass: count * item.mass });
      remaining -= count * item.mass;
    }
  }
  const total = items.reduce((sum, i) => sum + i.totalMass, 0);
  return { items, total, errorMargin: target > 0 ? ((total - target) / target) * 100 : 0 };
}

// --- SUB-COMPONENT: VISUAL ASSEMBLY PROTOCOL ---
function VisualAssemblyMap({ imageSrc, highlights }: { imageSrc: string; highlights: AssemblyHighlight[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} className="relative aspect-square border-4 border-neutral-800 bg-neutral-900 group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc} alt="Assembly Map Background" className="w-full h-full object-contain grayscale transition-all opacity-50 group-hover:opacity-100" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none">
        {highlights.map((pin, index) => (
          <g key={index}>
            <circle cx={pin.xPercent} cy={pin.yPercent} r="3" fill={pin.hexColor} stroke="white" strokeWidth="0.5" className="animate-pulse" />
            <text x={pin.xPercent + 4} y={pin.yPercent + 1} fill="white" fontSize="4" fontWeight="bold" className="font-sans uppercase tracking-tight">
                {(index+1)}. {pin.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute top-2 left-2 font-mono text-xs uppercase text-neutral-500 bg-black px-1">Visual Assembly Protocol</div>
    </div>
  );
}

// --- MAIN APP ---
export default function Haptics() {
  const [appState, setAppState] = useState<'HOME' | 'MANUAL' | 'VISION' | 'RESULT'>('HOME');
  const [manualInput, setManualInput] = useState<string>('');
  const [userDescription, setUserDescription] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetMass = analysis ? analysis.estimatedMassGrams : parseFloat(manualInput);
  const recipe = useMemo(() => calculateRecipe(targetMass), [targetMass]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImagePreview(URL.createObjectURL(file));
    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => { setImageBase64((reader.result as string).split(',')[1]); };
  };

  const handleVisionSubmit = async () => {
    if (!imageBase64 || !imageMimeType) return setError("Please select an annotated image first.");
    setError(null); setIsAnalyzing(true); setAnalysis(null);

    try {
      const res = await fetch('/api/analyze-cad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: imageMimeType, userDescription }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      
      if (json.data.confidence < 0.6 && !userDescription) {
        setError("AI rejected sketch: context insufficient. Fill out description field.");
      } else {
        setAnalysis(json.data); setAppState('RESULT');
      }
    } catch (err: any) { setError(err.message); } finally { setIsAnalyzing(false); }
  };

  const handleManualSubmit = async () => {
    const mass = parseFloat(manualInput);
    if (isNaN(mass) || mass <= 0) return setError("Enter a valid metric mass.");
    if (!userDescription.trim()) return setError("Context required. What is this object?");
    
    setError(null); setIsAnalyzing(true); setAnalysis(null);

    try {
      const res = await fetch('/api/analyze-cad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exactMass: mass, userDescription }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      
      json.data.estimatedMassGrams = mass; 
      setAnalysis(json.data); setAppState('RESULT');
    } catch (err: any) { setError(err.message); } finally { setIsAnalyzing(false); }
  };

  const resetApp = () => {
    setAppState('HOME'); setAnalysis(null); setManualInput(''); setUserDescription('');
    setImagePreview(null); setImageBase64(null); setError(null);
  };

  return (
    <main className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col">
      <header className="p-8 border-b-2 border-neutral-800 flex justify-between items-center cursor-pointer hover:text-gray-300" onClick={resetApp}>
        <h1 className="text-2xl font-black tracking-tighter uppercase">Haptics</h1>
        <span className="text-xs font-mono uppercase tracking-widest text-gray-500">Reset Engine</span>
      </header>

      <div className="flex-grow flex flex-col items-center justify-center p-8 md:p-12">
        {appState === 'HOME' && (
          <div className="max-w-4xl w-full flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-5xl md:text-8xl font-black uppercase tracking-tighter mb-6 leading-none">Stop guessing mass.</h2>
            <p className="text-xl md:text-2xl text-neutral-400 font-medium max-w-2xl mb-16 lowercase first-letter:uppercase leading-snug">
              CAD blindness causes ergonomic failure. Convert your digital mass into a junk-drawer model in seconds. Feel it before you print it. Asian context. Metric only.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <button onClick={() => setAppState('VISION')} className="group flex flex-col items-start p-8 border-4 border-neutral-800 hover:border-white transition-colors text-left bg-neutral-900">
                <span className="text-3xl font-black uppercase mb-2">Analyze Annotated Sketch</span>
                <span className="text-neutral-500 group-hover:text-neutral-300 font-mono text-sm lowercase first-letter:uppercase">Upload CAD with material callouts. AI calculates mass & ergonomics.</span>
              </button>
              <button onClick={() => setAppState('MANUAL')} className="group flex flex-col items-start p-8 border-4 border-neutral-800 hover:border-white transition-colors text-left bg-neutral-900">
                <span className="text-3xl font-black uppercase mb-2">Input Exact Grams</span>
                <span className="text-neutral-500 group-hover:text-neutral-300 font-mono text-sm lowercase first-letter:uppercase">Directly input known target weight for instant ergonomic routing.</span>
              </button>
            </div>
          </div>
        )}

        {appState === 'MANUAL' && (
          <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in duration-500">
            <div className="flex flex-col">
              <label className="text-3xl font-black uppercase mb-6 text-white block">Exact Target Mass</label>
              <p className="text-neutral-400 font-mono text-sm mb-8 lowercase first-letter:uppercase">Bypass vision parser. Input known mass in grams.</p>
              <div className="bg-neutral-900 p-12 border-4 border-neutral-800 h-full flex flex-col justify-center">
                 <input
                    type="number" autoFocus
                    value={manualInput} onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                    placeholder="000"
                    className="w-full bg-transparent border-b-8 border-white text-7xl md:text-[8rem] font-black tracking-tighter focus:outline-none placeholder-neutral-800 pb-4 text-center"
                  />
              </div>
            </div>
            <div className="flex flex-col space-y-6 pt-0 md:pt-[5.5rem]">
              <div className="p-6 border-4 border-neutral-800 bg-neutral-900">
                <label className="text-xl font-bold uppercase mb-2 block text-gray-400">Context & Intent</label>
                <textarea
                  value={userDescription} onChange={(e) => setUserDescription(e.target.value)}
                  placeholder="E.g., This is a handheld TV remote."
                  className="w-full h-32 bg-black border-2 border-neutral-700 p-4 text-sm font-mono focus:border-white focus:outline-none placeholder-neutral-700"
                />
                <p className="text-xs font-mono text-neutral-600 mt-2 uppercase">Required for ergonomic assessment engine.</p>
              </div>
              <button onClick={handleManualSubmit} disabled={isAnalyzing} className="bg-white text-black text-3xl font-black uppercase py-6 px-8 hover:bg-neutral-300 w-full text-left disabled:opacity-50">
                {isAnalyzing ? "Processing..." : "Analyze Intent ->"}
              </button>
              {error && <div className="p-4 bg-red-900 border-l-4 border-red-500 font-mono uppercase text-sm">{error}</div>}
            </div>
          </div>
        )}

        {appState === 'VISION' && (
          <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-[1fr,minmax(350px,400px)] gap-12 animate-in fade-in duration-500">
            <div className="flex flex-col">
              <h3 className="text-3xl font-black uppercase mb-6">Upload Annotated Sketch</h3>
              <p className="text-neutral-400 font-mono text-sm mb-8 lowercase first-letter:uppercase">Image MUST contain material callouts and dimension scaling. Asian Household context.</p>
              <div className="border-4 border-dashed border-neutral-700 hover:border-white transition-colors relative flex flex-col items-center justify-center p-20 text-center min-h-[400px] bg-neutral-900">
                <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                {imageBase64 ? (
                   <div className="absolute inset-0 p-4">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img src={imagePreview!} alt="Selected Design" className="w-full h-full object-contain grayscale opacity-60" />
                   </div>
                ) : (
                   <span className="font-mono text-2xl uppercase text-neutral-500 pointer-events-none">Drop Design Image</span>
                )}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20">
                    <span className="font-mono animate-pulse text-3xl uppercase font-black text-white">Crunching Physics...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col space-y-6 pt-16">
              <div className="p-6 border-4 border-neutral-800 bg-neutral-900">
                <label className="text-xl font-bold uppercase mb-2 block text-gray-400">Context & Intent (Chat)</label>
                <textarea
                  value={userDescription} onChange={(e) => setUserDescription(e.target.value)}
                  placeholder="E.g., This is a clip-on logging device for a shirt collar. Weight must be <30g."
                  className="w-full h-32 bg-black border-2 border-neutral-700 p-4 text-sm font-mono focus:border-white focus:outline-none placeholder-neutral-700"
                />
                <p className="text-xs font-mono text-neutral-600 mt-2 uppercase">Provide functional utility and constraints.</p>
              </div>
              <button onClick={handleVisionSubmit} disabled={isAnalyzing} className="bg-white text-black text-3xl font-black uppercase py-6 px-8 hover:bg-neutral-300 w-full text-left disabled:opacity-50">
                {isAnalyzing ? "Analyzing..." : "Analyze Design ->"}
              </button>
              {error && <div className="p-4 bg-red-900 border-l-4 border-red-500 font-mono uppercase text-sm">{error}</div>}
            </div>
          </div>
        )}

        {appState === 'RESULT' && recipe && analysis && (
          <div className="max-w-screen-2xl w-full flex flex-col space-y-12 animate-in fade-in duration-500">
            <div className={`p-8 md:p-12 border-4 ${analysis.primaryVerdictHeading.includes('FAIL') || analysis.primaryVerdictHeading.includes('FATAL') ? 'border-red-600 bg-red-900/10' : 'border-white'} animate-in fade-in slide-in-from-top-4 duration-500`}>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4 leading-none text-white">{analysis.primaryVerdictHeading}</h2>
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6 text-neutral-400 font-medium lowercase first-letter:uppercase">
                 <p className="max-w-3xl text-lg leading-relaxed">{analysis.primaryVerdictBody}</p>
                 <p className="max-w-3xl text-lg leading-relaxed text-gray-100">{analysis.suggestedJunkSimulations}</p>
                 <div className="font-mono text-xs text-neutral-600 text-right uppercase pt-1 min-w-[200px]">
                    Category: {analysis.objectCategory || 'UNKNOWN'} | confidence: {(analysis.confidence * 100).toFixed(0)}%
                 </div>
              </div>
              <div className="font-mono text-xs text-neutral-700 mt-4 uppercase border-t border-neutral-800 pt-2 first-letter:uppercase lowercase">{analysis.userIntentContext}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr,minmax(400px,1fr)] gap-12">
              <div className="bg-white text-black p-8 md:p-12">
                <h3 className="text-6xl font-black uppercase tracking-tighter mb-2">Recipe</h3>
               <div className="font-mono font-bold text-neutral-500 border-b-4 border-black pb-8 mb-8 flex justify-between uppercase">
  <span>TARGET MASS: {targetMass.toFixed(1)}g</span>
  <span className={Math.abs(recipe.errorMargin) > 5 ? 'text-red-600 font-black' : 'text-black font-black'}>
    DELTA (WEIGHT DIFF): {recipe.errorMargin > 0 ? '+' : ''}{recipe.errorMargin.toFixed(1)}%
  </span>
</div>
                </div>
                
                <ul className="space-y-6">
                  {recipe.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between items-end border-b-2 border-neutral-300 pb-2">
                      <span className="text-2xl md:text-3xl font-bold uppercase"><span className="text-neutral-400 mr-2 lowercase">{item.count}×</span>{item.name}</span>
                      <span className="font-mono text-xl">{item.totalMass.toFixed(1)}g</span>
                    </li>
                  ))}
                  <li className="pt-8 flex justify-between items-end uppercase">
                    <span className="font-black uppercase text-2xl">Junk Model Total:</span>
                    <span className="font-mono text-4xl block font-black">{recipe.total.toFixed(1)}g</span>
                  </li>
                </ul>
              </div>

              {imagePreview ? (
                <VisualAssemblyMap imageSrc={imagePreview} highlights={analysis.assemblyHighlights} />
              ) : (
                <div className="border-4 border-neutral-800 bg-neutral-900 p-12 flex flex-col justify-center items-center text-center">
                   <span className="font-mono text-neutral-500 uppercase text-xl font-bold">Visual Map Disabled</span>
                   <span className="font-mono text-sm text-neutral-700 mt-2 uppercase">Manual Entry: No spatial reference provided.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="w-full border-t-2 border-neutral-800 p-6 text-center mt-auto">
        <span className="font-mono text-[10px] text-neutral-600 uppercase tracking-widest block opacity-50 hover:opacity-100 transition-opacity">
          Made by <span className="font-bold">... .- .- -.. / .- .... -- . -.. / ... .... .- .. -.- ....</span>
        </span>
      </footer>
    </main>
  );
}
