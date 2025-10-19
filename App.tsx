/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { generateHouseImage, generateBaseModelViews } from './services/geminiService';
import { CustomizationOptions } from './types';
import Header from './components/Header';
import Spinner from './components/Spinner';

const initialOptions: CustomizationOptions = {
  colorTheme: 'Tropical Light',
  doors: 'Glass Sliding',
  windows: 'Jalousie',
  frontYard: 'Tropical Garden',
  landscaping: 'None',
  outdoorFeatures: 'None',
  roof: 'Standard Metal Roof',
  furniture: 'None',
};

// Type guard for customization keys
function isCustomizationKey(key: string): key is keyof CustomizationOptions {
  return key in initialOptions;
}

const App: React.FC = () => {
  const [options, setOptions] = useState<CustomizationOptions>(initialOptions);
  const [budget, setBudget] = useState<number>(350000);
  const [baseImageFile, setBaseImageFile] = useState<File | null>(null);
  const [baseImageUrl, setBaseImageUrl] = useState<string>('');
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([]);
  const [numberOfVariations, setNumberOfVariations] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the base image from the prompt with a fallback mechanism.
  useEffect(() => {
    const fetchBaseImage = async () => {
      setIsLoading(true);
      setError(null);

      const pathsToTry = ['/prefab.png', '/image.png', '/image-0.png'];
      let response: Response | null = null;
      let successfulPath: string | null = null;

      for (const path of pathsToTry) {
        try {
          const res = await fetch(path);
          if (res.ok) {
            response = res;
            successfulPath = path;
            break; // Found it, exit loop
          }
          if (res.status !== 404) {
            throw new Error(`Server responded with status: ${res.status}`);
          }
          // If 404, continue to the next path
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setError(`Failed to fetch base image. ${errorMessage}`);
          setIsLoading(false);
          return; // Stop on non-404 or network error
        }
      }

      if (response && successfulPath) {
        try {
          const blob = await response.blob();
          const filename = successfulPath.substring(successfulPath.lastIndexOf('/') + 1);
          
          // Manually determine MIME type if server provides a generic one.
          let mimeType = blob.type;
          if (!mimeType || mimeType === 'application/octet-stream') {
            const extension = filename.split('.').pop()?.toLowerCase();
            if (extension === 'png') {
              mimeType = 'image/png';
            } else if (extension === 'jpg' || extension === 'jpeg') {
              mimeType = 'image/jpeg';
            }
          }
          
          const file = new File([blob], filename, { type: mimeType });
          const objectUrl = URL.createObjectURL(file);
          
          setBaseImageFile(file);
          setBaseImageUrl(objectUrl);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setError(`Failed to process the loaded base image. ${errorMessage}`);
        }
      } else {
        setError('Failed to load the base house image. Tried /prefab.png, /image.png and /image-0.png, but they were not found. Please ensure an image is included in the prompt.');
      }
      setIsLoading(false);
    };

    fetchBaseImage();
  }, []);
  
  // Effect for cleaning up Object URLs to prevent memory leaks
  useEffect(() => {
      return () => {
          if (baseImageUrl) URL.revokeObjectURL(baseImageUrl);
          if (generatedImageUrls.length > 0) {
            generatedImageUrls.forEach(url => URL.revokeObjectURL(url));
          }
      }
  }, [baseImageUrl, generatedImageUrls]);

  const buildPrompt = useCallback((): string => {
    const furniturePrompt = options.furniture !== 'None' 
      ? `
- **Furniture:** Add a '${options.furniture}'. Place it naturally within any visible front yard or patio area. The furniture must be weather-resistant, complement the overall design, and be appropriate for a tropical climate.`
      : '';
    
    const landscapingPrompt = options.landscaping !== 'None'
      ? `
  - **Landscaping Theme:** Within the front yard, introduce a '${options.landscaping}' theme.
    - 'Minimalist Zen Garden': Use raked white sand, a few carefully placed boulders, and perhaps a single bonsai-style tree.
    - 'Flowering Tropical Paradise': Add an abundance of colorful, local flowering plants like hibiscus, bougainvillea, and birds of paradise.
    - 'Rock Garden with Cacti': A dry-style garden with various types of rocks, pebbles, and succulents or cacti suitable for a tropical climate.
    - 'Vegetable Patch': Create a neat, organized section with raised garden beds for growing vegetables.`
      : '';

    return `You are an expert architectural visualizer specializing in tropical design for the Philippines. Your task is to take the provided 3D render of an L-shaped modular home and place it into a photorealistic scene, modifying it according to the specifications below. The final image should be high-resolution and perfectly suited for a humid, tropical climate, maintaining the original structure's shape, perspective, and camera angle.

**Scene & Setting:** Create a lush, tropical environment in the Philippines to serve as the background and surroundings for the house.

**Lighting & Realism:** The scene must be rendered with hyper-realistic lighting appropriate for the Philippines. This includes soft, diffused sunlight (like a bright, slightly overcast day) that casts gentle shadows. Incorporate subtle ambient occlusion to give the structure and surrounding objects a sense of depth and grounding.

**Material & Texture Details:**
- **Wood:** When 'Narra Wood' or other wood accents are specified, render them with a rich, visible grain and a semi-gloss finish, showcasing the natural beauty of treated tropical hardwood.
- **Metal:** Metal roofs and trims should exhibit a subtle, realistic sheen that catches the light, indicating their material quality without being overly glossy.
- **Glass:** All glass surfaces (windows, sliding doors) must be highly reflective, clearly mirroring the lush tropical surroundings, clouds, and sky to enhance realism.

**Modifications to the House:**

- **Color & Style:** Apply the '${options.colorTheme}' theme to the building.
  - 'Neutral Modern': Use light gray and white tones for walls and trims to reflect heat.
  - 'Warm Natural': Use beige, cream, and local tropical wood accents (like Narra or Mahogany).
  - 'Dark Industrial': Use charcoal gray or black with matte black metal trims, often used for modern tropical homes.
  - 'Tropical Light': Use off-white or very light pastel colors with natural wood accents, creating an airy feel.

- **Doors:** Change the doors to '${options.doors}'. They must be suitable for tropical weather (durable against humidity and heat).
  - 'Narra Wood': A classic, beautiful, and durable Filipino hardwood door.
  - 'Steel Security': A practical, strong door for security.
  - 'Glass Sliding': Large sliding glass doors to maximize light and views, with strong frames.
  - 'Double Swing Wood': A grand entrance with two swinging wooden doors.

- **Windows:** Change the windows to '${options.windows}'. They should promote ventilation and natural light.
  - 'Clear Glass Sliding': Standard sliding windows.
  - 'Tinted Glass': Darkened glass to reduce solar glare and heat.
  - 'Jalousie': The classic Filipino window with glass slats for maximum airflow, even during light rain.
  - 'Awning Windows': Windows hinged at the top, allowing ventilation while providing shelter from rain.

- **Front Yard:** Create a front yard in a '${options.frontYard}' style.
  - 'Tropical Garden': Lush greenery with local Filipino plants like plumeria (kalachuchi), hibiscus (gumamela), palms, and broad-leafed plants.
  - 'Modern Tiled Patio': Use non-slip ceramic or concrete tiles for a clean, modern outdoor living space, perhaps with a small patch of grass.
  - 'Simple Bermuda Grass': A clean, manicured lawn.
  - 'Gravel & Planters': Use of decorative gravel (white or gray) with large concrete planters for a low-maintenance, modern look.${landscapingPrompt}

- **Roof:** Modify the roof to be a '${options.roof}'.
  - 'Standard Metal Roof': A typical long-span corrugated metal roof, common in the Philippines.
  - 'Metal Roof with Solar Panels': Add sleek, modern solar panels to the metal roof.
  - 'Clay Tile Roof': Add a classic Spanish-style clay tile (tegula) roof, which helps keep the interior cool.

- **Outdoor Features:** Add the following feature: '${options.outdoorFeatures}'.
  - If not 'None', place it naturally within the scene.
  - '2-Seater Kape Table': A small cafe table set for two, for enjoying coffee outdoors.
  - '4-Seater Outdoor Dining': A larger table set for four.
  - 'Bamboo Bench': A simple, locally-styled bamboo bench.
  - 'Hammock (Duyan)': A traditional Filipino hammock.${furniturePrompt}

**Important Rules:**
1.  ONLY modify the aspects of the house listed above. Maintain the L-shape.
2.  The result must be a single, photorealistic image.
3.  Do not add any text, labels, or watermarks.

The output should ONLY be the final, modified image.`;
  }, [options]);

  const handleGenerate = useCallback(async () => {
    if (!baseImageFile) {
      setError('Base image is not loaded. Cannot generate a new design.');
      return;
    }
    setIsLoading(true);
    setError(null);
    if(generatedImageUrls.length > 0) {
      generatedImageUrls.forEach(url => URL.revokeObjectURL(url));
    }

    try {
      const prompt = buildPrompt();
      console.log(`Generating ${numberOfVariations} variations with prompt:`, prompt);
      const { finalImageUrls } = await generateHouseImage(baseImageFile, prompt, numberOfVariations);
      setGeneratedImageUrls(finalImageUrls);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate the image. ${errorMessage}`);
      console.error(err);
      setGeneratedImageUrls([]); // Clear on error
    } finally {
      setIsLoading(false);
    }
  }, [baseImageFile, buildPrompt, generatedImageUrls, numberOfVariations]);
  
  const handleGenerateBaseViews = useCallback(async () => {
    if (!baseImageFile) {
      setError('Base image is not loaded. Cannot generate views.');
      return;
    }
    setIsLoading(true);
    setError(null);
    if (generatedImageUrls.length > 0) {
        generatedImageUrls.forEach(url => URL.revokeObjectURL(url));
    }

    try {
      const { finalImageUrl } = await generateBaseModelViews(baseImageFile);
      setGeneratedImageUrls([finalImageUrl]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate base model views. ${errorMessage}`);
      console.error(err);
      setGeneratedImageUrls([]); // Clear on error
    } finally {
      setIsLoading(false);
    }
  }, [baseImageFile, generatedImageUrls]);

  const handleReset = useCallback(() => {
    if (generatedImageUrls.length > 0) {
      generatedImageUrls.forEach(url => URL.revokeObjectURL(url));
    }
    setGeneratedImageUrls([]);
    setOptions(initialOptions);
    setError(null);
  }, [generatedImageUrls]);

  const handleDownloadImage = useCallback((url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    const isBaseImage = generatedImageUrls.length === 0;
    const filename = isBaseImage 
      ? `base-house-design.png` 
      : `tropical-house-design-variation-${index + 1}.png`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImageUrls]);
  
  const optionFields = useMemo(() => [
    { id: 'colorTheme', label: 'Color Theme', values: ['Tropical Light', 'Neutral Modern', 'Warm Natural', 'Dark Industrial'] },
    { id: 'doors', label: 'Doors', values: ['Narra Wood', 'Steel Security', 'Glass Sliding', 'Double Swing Wood'] },
    { id: 'windows', label: 'Windows', values: ['Jalousie', 'Clear Glass Sliding', 'Tinted Glass', 'Awning Windows'] },
    { id: 'frontYard', label: 'Frontyard Style', values: ['Tropical Garden', 'Modern Tiled Patio', 'Simple Bermuda Grass', 'Gravel & Planters'] },
    { id: 'landscaping', label: 'Landscaping Style', values: ['None', 'Minimalist Zen Garden', 'Flowering Tropical Paradise', 'Rock Garden with Cacti', 'Vegetable Patch'] },
    { id: 'outdoorFeatures', label: 'Outdoor Features', values: ['None', '2-Seater Kape Table', '4-Seater Outdoor Dining', 'Bamboo Bench', 'Hammock (Duyan)'] },
    { id: 'furniture', label: 'Outdoor Furniture', values: ['None', 'Wicker Sofa Set', 'Wooden Dining Table for 4', 'Pair of Sun Loungers'] },
    { id: 'roof', label: 'Roof Style', values: ['Standard Metal Roof', 'Metal Roof with Solar Panels', 'Clay Tile Roof'] }
  ], []);

  const handleOptionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (isCustomizationKey(name)) {
        setOptions(prev => ({ ...prev, [name]: value as any }));
    }
  }, []);
  
  const renderControlPanel = () => (
    <div className="w-full bg-white p-6 rounded-2xl shadow-lg border border-zinc-200 flex flex-col gap-5">
        <h2 className="text-2xl font-extrabold text-zinc-800 border-b pb-4">Customize Your House</h2>
        
        <div>
          <label htmlFor="variations" className="block text-sm font-bold text-zinc-600 mb-2">Number of Variations</label>
          <select
            id="variations"
            name="variations"
            value={numberOfVariations}
            onChange={(e) => setNumberOfVariations(Number(e.target.value))}
            className="w-full p-3 bg-zinc-100 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          >
            <option value={1}>1 Variation</option>
            <option value={3}>3 Variations</option>
            <option value={5}>5 Variations</option>
          </select>
        </div>

        {optionFields.map(field => (
            <div key={field.id}>
                <label htmlFor={field.id} className="block text-sm font-bold text-zinc-600 mb-2">{field.label}</label>
                <select 
                    id={field.id}
                    name={field.id}
                    value={options[field.id as keyof CustomizationOptions]}
                    onChange={handleOptionChange}
                    className="w-full p-3 bg-zinc-100 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                >
                    {field.values.map(val => <option key={val} value={val}>{val}</option>)}
                </select>
            </div>
        ))}
        <div className="mt-auto pt-5 flex flex-col gap-3">
            <button 
                onClick={handleGenerate} 
                disabled={isLoading || !baseImageFile}
                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors text-lg"
            >
                {isLoading ? 'Generating...' : 'Generate Custom Design'}
            </button>
            <button
                onClick={handleGenerateBaseViews}
                disabled={isLoading || !baseImageFile}
                className="w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 disabled:bg-zinc-400 disabled:cursor-not-allowed transition-colors text-lg"
            >
                Generate Base Model Views
            </button>
            <button 
                onClick={handleReset} 
                disabled={isLoading || !baseImageFile}
                className="w-full bg-zinc-200 text-zinc-700 font-bold py-2 px-4 rounded-lg hover:bg-zinc-300 disabled:opacity-50 transition-colors"
            >
                Reset
            </button>
        </div>
    </div>
  );

  const renderBudgetControl = () => (
    <div className="w-full bg-white p-6 rounded-2xl shadow-lg border border-zinc-200">
      <h2 className="text-2xl font-extrabold text-zinc-800 border-b pb-4 mb-4">Project Budget</h2>
      <label htmlFor="budget" className="block text-lg font-bold text-zinc-600 mb-2">
        Estimated Budget: {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(budget)}
      </label>
      <input
        type="range"
        id="budget"
        name="budget"
        min="350000"
        max="2000000"
        step="10000"
        value={budget}
        onChange={(e) => setBudget(Number(e.target.value))}
        className="w-full h-3 bg-zinc-200 rounded-lg appearance-none cursor-pointer"
        aria-label="Project budget slider"
      />
      <div className="flex justify-between text-xs text-zinc-500 mt-2">
        <span>₱350K</span>
        <span>₱2M</span>
      </div>
    </div>
  );
  
  const renderImageDisplay = () => {
    const urlsToDisplay = generatedImageUrls.length > 0 ? generatedImageUrls : (baseImageUrl ? [baseImageUrl] : []);
    const isSingleImage = urlsToDisplay.length <= 1;
    const loadingText = isLoading ? (baseImageFile ? `Generating ${numberOfVariations} design(s)...` : 'Loading base image...') : '';

    return (
     <div className="w-full max-w-5xl flex-grow flex items-center justify-center">
        <div className="w-full aspect-video bg-zinc-100 rounded-2xl shadow-lg border border-zinc-200 flex items-center justify-center relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center animate-fade-in">
                  <Spinner />
                  <p className="mt-4 text-zinc-600 font-semibold">{loadingText}</p>
              </div>
            )}
            
            {error && urlsToDisplay.length === 0 && (
                <div className="p-8 text-center text-red-700">
                    <h3 className="font-bold text-lg mb-2">Error</h3>
                    <p>{error}</p>
                </div>
            )}
            
            {urlsToDisplay.length > 0 ? (
                <div className={`w-full h-full overflow-y-auto scrollbar-hide ${isSingleImage ? 'flex items-center justify-center' : 'p-4'}`}>
                    <div className={isSingleImage ? 'w-full h-full' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'}>
                        {urlsToDisplay.map((url, index) => {
                          const isBaseImage = generatedImageUrls.length === 0;
                          const altText = isBaseImage ? 'Base House Model' : (isSingleImage ? 'Customized House' : `Variation ${index + 1}`);

                          return (
                            <div key={index} className="relative group w-full h-full bg-zinc-200 rounded-lg overflow-hidden shadow-md">
                                <img 
                                    src={url} 
                                    alt={altText} 
                                    className="w-full h-full object-contain animate-fade-in" 
                                />
                                <button
                                  onClick={() => handleDownloadImage(url, index)}
                                  className="absolute bottom-3 right-3 bg-zinc-800/60 text-white p-2 rounded-full hover:bg-zinc-800/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-800 focus:ring-white transition-all transform-gpu opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  aria-label={`Download ${altText}`}
                                  title={`Download ${altText}`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                            </div>
                          )
                        })}
                    </div>
                </div>
            ) : null}
        </div>
     </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 flex flex-col p-4 md:p-8">
      <Header />
      <main className="w-full max-w-screen-2xl mx-auto flex-grow flex flex-col items-center gap-8 mt-6">
        {renderImageDisplay()}
        <div className="w-full max-w-5xl flex flex-col gap-8">
            {renderBudgetControl()}
            {renderControlPanel()}
        </div>
      </main>
    </div>
  );
}

export default App;