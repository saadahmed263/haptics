'use client';

import { useState, useMemo, useRef } from 'react';

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

function VisualAssemblyMap({ imageSrc, highlights }: { imageSrc: string; highlights: AssemblyHighlight[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} className="relative aspect-square border-4 border-neutral-800 bg-neutral-900 group">
      <img src={imageSrc} alt="Assembly Map" className="w-full h-full object-contain grayscale transition-all opacity-50 group-hover:opacity-100" />
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
  const recipe = useMemo(() => calculateRecipe(targetMass || 0), [targetMass]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => { setImageBase64((reader.result as string).split(',')[1]); };
  };

  const handleVisionSubmit = async () => {
    if (!imageBase64 || !imageMimeType) return setError("Select an image.");
    setError(null); setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-cad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: imageMimeType, userDescription }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAnalysis(json.data); setAppState('RESULT');
    } catch (err: any) { setError(err.message); } finally { setIsAnalyzing(false); }
  };

  const handleManualSubmit = async () => {
    const mass = parseFloat(manualInput);
    if (isNaN(mass) || mass <= 0) return setError("Enter mass.");
    setError(null); setIsAnalyzing(true);
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

  return (
    <main className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col">
      <header className="p-8 border-b-2 border-neutral-800 flex justify-between items-center cursor-pointer" onClick={() => setAppState('HOME')}>
        <h1 className="text-2xl font-black uppercase tracking-tighter">Haptics</h1>
        <span className="text-xs font-mono text-gray-500">RESET ENGINE</span>
      </header>

      <div className="flex-grow flex flex-col items-center justify-center p-8">
        {appState === 'HOME' && (
          <div className="max-w-4xl text-center">
            <h2 className="text-6xl md:text-8xl font-black uppercase mb-6">Stop guessing mass.</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-12">
              <button onClick={() => setAppState('VISION')} className="p-8 border-4 border-neutral-800 hover:border-white bg-neutral-900 text-left uppercase font-black text-2xl">Analyze Sketch</button>
              <button onClick={() => setAppState('MANUAL')} className="p-8 border-4 border-neutral-800 hover:border-white bg-neutral-900 text-left uppercase font-black text-2xl">Input Grams</button>
            </div>
          </div>
        )}

        {appState === 'MANUAL' && (
          <div className="max-w-4xl w-full">
            <input type="number" value={manualInput} onChange={(e) => setManualInput(e.target.value)} className="w-full bg-transparent border-b-8 border-white text-8xl font-black text-center mb-8 focus:outline-none" placeholder="000" />
            <textarea value={userDescription} onChange={(e) => setUserDescription(e.target.value)} className="w-full bg-neutral-900 border-2 border-neutral-700 p-4 font-mono mb-6" placeholder="CONTEXT..." />
            <button onClick={handleManualSubmit} className="w-full bg-white text-black font-black text-3xl py-6 uppercase">Analyze Intent</button>
          </div>
        )}

        {appState === 'VISION' && (
          <div className="max-w-4xl w-full">
             <div className="border-4 border-dashed border-neutral-700 p-20 text-center bg-neutral-900 relative">
                <input type="file" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                {imagePreview ? <img src={imagePreview} className="max-h-64 mx-auto grayscale" alt="preview" /> : <span className="font-black uppercase text-2xl text-neutral-500">Drop Image</span>}
             </div>
             <textarea value={userDescription} onChange={(e) => setUserDescription(e.target.value)} className="w-full bg-neutral-900 border-2 border-neutral-700 p-4 font-mono my-6" placeholder="CONTEXT..." />
             <button onClick={handleVisionSubmit} className="w-full bg-white text-black font-black text-3xl py-6 uppercase">{isAnalyzing ? '...' : 'Analyze Design'}</button>
          </div>
        )}

        {appState === 'RESULT' && analysis && (
          <div className="max-w-5xl w-full space-y-8">
            <div className="border-4 border-white p-8">
              <h2 className="text-4xl font-black uppercase mb-4">{analysis.primaryVerdictHeading}</h2>
              <p className="text-neutral-400 text-lg mb-4">{analysis.primaryVerdictBody}</p>
              <p className="text-white text-lg font-bold italic">{analysis.suggestedJunkSimulations}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white text-black p-8">
                <div className="flex justify-between font-black border-b-4 border-black pb-4 mb-4 uppercase text-sm">
                  <span>Target: {targetMass}g</span>
                  <span>Delta (Weight Diff): {recipe.errorMargin > 0 ? '+' : ''}{recipe.errorMargin.toFixed(1)}%</span>
                </div>
                <ul className="space-y-4">
                  {recipe.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between border-b border-neutral-200 pb-2">
                      <span className="font-bold uppercase">{item.count}x {item.name}</span>
                      <span className="font-mono">{item.totalMass}g</span>
                    </li>
                  ))}
                  <li className="pt-4 flex justify-between font-black text-2xl uppercase">
                    <span>Total:</span>
                    <span>{recipe.total}g</span>
                  </li>
                </ul>
              </div>
              {imagePreview && <VisualAssemblyMap imageSrc={imagePreview} highlights={analysis.assemblyHighlights} />}
            </div>
          </div>
        )}
        {error && <div className="mt-4 p-4 bg-red-900 font-mono text-xs uppercase">{error}</div>}
      </div>
    </main>
  );
}
