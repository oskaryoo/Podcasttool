import { useState, useRef, useEffect } from 'react';
import GIF from 'gif.js';
// import GIFWorker from 'gif.js/dist/gif.worker.js?url'; // Removed for production compatibility
import html2canvas from 'html2canvas';

const GRID_SIZE = 4;
const MAX_IMAGE_SIZE = 2048;

// Helper to check if a cell is covered by the 3x3 image
function isCoveredByImage(row, col, imageRow, imageCol) {
  return row >= imageRow && row < imageRow + 3 && col >= imageCol && col < imageCol + 3;
}

// Helper to interpolate between two colors
function interpolateColor(color1, color2, t) {
  // color1, color2: hex strings, t: 0 (color1) to 1 (color2)
  const c1 = [parseInt(color1.slice(1, 3), 16), parseInt(color1.slice(3, 5), 16), parseInt(color1.slice(5, 7), 16)];
  const c2 = [parseInt(color2.slice(1, 3), 16), parseInt(color2.slice(3, 5), 16), parseInt(color2.slice(5, 7), 16)];
  const c = c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Helper to get random gradient direction
function getRandomGradientDirection() {
  const directions = ['180deg', '0deg', '90deg', '270deg'];
  return directions[Math.floor(Math.random() * directions.length)];
}

// Helper to ensure a color is a valid hex code
function ensureHex(color, fallback = '#000000') {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : fallback;
}

// Add logo import at the top
const imgLogo = "http://localhost:3845/assets/ca17e1b1c220829357b878920d5466b60adcd654.svg";

export default function App() {
  // 0 = circle, 1 = square
  const [grid, setGrid] = useState(
    Array(GRID_SIZE * GRID_SIZE).fill(0)
  );
  const [gradientStart, setGradientStart] = useState('#000000');
  const [gradientEnd, setGradientEnd] = useState('#aaaaaa');
  const [imageUrl, setImageUrl] = useState(null);
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [circleRatio, setCircleRatio] = useState(5); // 1-10, default 5
  const [imagePosition, setImagePosition] = useState({ row: 1, col: 1 }); // default center
  const [gradientDirections, setGradientDirections] = useState(
    Array(GRID_SIZE * GRID_SIZE).fill('180deg')
  );
  const [isGeneratingGif, setIsGeneratingGif] = useState(false);
  const [gifUrl, setGifUrl] = useState(null);
  const [gifSuccess, setGifSuccess] = useState(false);
  const [gifError, setGifError] = useState(null);
  const canvasRef = useRef();
  const gridRef = useRef();
  // Add useRef and useEffect for dynamic sizing
  const logoColRef = useRef(null);
  const [logoColWidth, setLogoColWidth] = useState(null);
  useEffect(() => {
    if (logoColRef.current) {
      const handleResize = () => setLogoColWidth(logoColRef.current.offsetWidth);
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const toggleShape = (idx) => {
    setGrid((prev) => {
      const newGrid = [...prev];
      newGrid[idx] = newGrid[idx] === 0 ? 1 : 0;
      return newGrid;
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      // Randomize image position when uploading
      const randomRow = Math.floor(Math.random() * 2); // 0 or 1
      const randomCol = Math.floor(Math.random() * 2); // 0 or 1
      setImagePosition({ row: randomRow, col: randomCol });
    }
  };

  // Randomize grid based on circle ratio
  const randomizeGrid = () => {
    const newGrid = [];
    const newDirections = [];
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const random = Math.random() * 10;
      newGrid.push(random < circleRatio ? 0 : 1); // 0 = circle, 1 = square
      newDirections.push(getRandomGradientDirection());
    }
    setGrid(newGrid);
    setGradientDirections(newDirections);
    
    // Randomize image position if image exists
    if (processedImageUrl) {
      const randomRow = Math.floor(Math.random() * 2); // 0 or 1
      const randomCol = Math.floor(Math.random() * 2); // 0 or 1
      setImagePosition({ row: randomRow, col: randomCol });
    }
  };

  // Generate GIF function
  const generateGif = async () => {
    if (!gridRef.current) return;
    setIsGeneratingGif(true);
    setGifUrl(null);
    setGifSuccess(false);
    setGifError(null);
    try {
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: gridRef.current.offsetWidth,
        height: gridRef.current.offsetHeight,
        workerScript: '/gif.worker.js', // Use public path for production
        repeat: 0, // infinite loop
        delay: 1000, // 1 frame per second
      });

      // Capture 5 frames
      for (let i = 0; i < 5; i++) {
        randomizeGrid();
        await new Promise(resolve => setTimeout(resolve, 100));
        // Use html2canvas to capture the actual grid DOM
        const canvas = await html2canvas(gridRef.current, {backgroundColor: null});
        // Fill the canvas with the gradient start color before adding to GIF
        const ctx = canvas.getContext('2d');
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = safeGradientStart;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        gif.addFrame(canvas, { delay: 1000 });
      }
      gif.on('finished', (blob) => {
        try {
          const url = URL.createObjectURL(blob);
          setGifUrl(url);
          setGifSuccess(true);
          // Try auto-download
          const a = document.createElement('a');
          a.href = url;
          a.download = 'grid-animation.gif';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setIsGeneratingGif(false);
        } catch (err) {
          setGifError('GIF generated but could not be downloaded automatically. Use the link below.');
          setIsGeneratingGif(false);
        }
      });
      gif.on('error', (err) => {
        setGifError('GIF generation failed: ' + err.message);
        setIsGeneratingGif(false);
      });
      gif.render();
    } catch (err) {
      setGifError('GIF generation failed: ' + err.message);
      setIsGeneratingGif(false);
    }
  };

  // Process the image to grayscale and remap colors
  useEffect(() => {
    if (!imageUrl) return;
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    img.onload = () => {
      // Clamp the image size to MAX_IMAGE_SIZE
      const scale = Math.min(MAX_IMAGE_SIZE / img.width, MAX_IMAGE_SIZE / img.height, 1);
      const sizeW = Math.round(img.width * scale);
      const sizeH = Math.round(img.height * scale);
      const canvas = canvasRef.current;
      canvas.width = sizeW;
      canvas.height = sizeH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, sizeW, sizeH);
      const imageData = ctx.getImageData(0, 0, sizeW, sizeH);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale value
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        // Map gray (0-255) to t (0-1)
        const t = gray / 255;
        const rgb = interpolateColor(gradientStart, gradientEnd, t).match(/\d+/g).map(Number);
        data[i] = rgb[0];
        data[i+1] = rgb[1];
        data[i+2] = rgb[2];
        // keep alpha
      }
      ctx.putImageData(imageData, 0, 0);
      setProcessedImageUrl(canvas.toDataURL());
    };
  }, [imageUrl, gradientStart, gradientEnd]);

  // Use safe hex colors everywhere
  const safeGradientStart = ensureHex(gradientStart, '#ff7e5f');
  const safeGradientEnd = ensureHex(gradientEnd, '#feb47b');

  // Render grid cells, inserting the image at random position
  const cells = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      // Place the image at the random position
      if (processedImageUrl && row === imagePosition.row && col === imagePosition.col) {
        cells.push(
          <div
            key="image-cell"
            style={{
              gridColumn: `${imagePosition.col + 1} / span 3`,
              gridRow: `${imagePosition.row + 1} / span 3`,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={processedImageUrl}
              alt="Processed"
              style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '1 / 1', borderRadius: 0 }}
            />
          </div>
        );
        // Skip the next 2 columns in this row and next 2 rows
        col += 2;
      } else if (processedImageUrl && isCoveredByImage(row, col, imagePosition.row, imagePosition.col)) {
        // Skip cells covered by the image
        continue;
      } else {
        const idx = row * GRID_SIZE + col;
        cells.push(
          <div
            key={idx}
            onClick={() => toggleShape(idx)}
            style={
              grid[idx] === 0
                ? {
                    width: '100%',
                    height: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '50%',
                    backgroundImage: `radial-gradient(circle, ${safeGradientStart}, ${safeGradientEnd})`,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    margin: 0,
                    padding: 0,
                  }
                : {
                    width: '100%',
                    height: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: 0,
                    backgroundImage: `linear-gradient(${gradientDirections[idx]}, ${safeGradientStart}, ${safeGradientEnd})`,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    margin: 0,
                    padding: 0,
                  }
            }
          />
        );
      }
    }
  }

  // Add a responsive style block for small screens
  // (This is a quick inline style approach; for production, use a CSS file or CSS-in-JS solution)
  const responsiveStyle = `
    @media (max-width: 900px) {
      .app-flex-root {
        flex-direction: column !important;
      }
      .app-flex-grid, .app-flex-controls {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        padding: 1rem !important;
      }
    }
  `;

  return (
    <>
      <style>{responsiveStyle}</style>
      <style>{`
        input.custom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: #fff;
          border: none;
          border-radius: 0;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
          margin-top: 0;
        }
        input.custom-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #fff;
          border: none;
          border-radius: 0;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        }
        input.custom-slider::-ms-thumb {
          width: 20px;
          height: 20px;
          background: #fff;
          border: none;
          border-radius: 0;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        }
        input.custom-slider::-webkit-slider-runnable-track {
          height: 20px;
          background: #000;
          border-radius: 10px;
        }
        input.custom-slider::-ms-fill-lower,
        input.custom-slider::-ms-fill-upper {
          background: #000;
          border-radius: 10px;
        }
        input.custom-slider::-moz-range-track {
          height: 20px;
          background: #000;
          border-radius: 10px;
        }
        input.custom-slider:focus {
          outline: none;
        }
        input.custom-slider {
          outline: none;
        }
      `}</style>
      <div className="app-flex-root" style={{ display: 'flex', width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.05)', flexDirection: 'row', columnGap: '1rem', overflowX: 'auto', padding: '1rem', boxSizing: 'border-box', overscrollBehavior: 'none' }}>
        {/* Left: Grid Tool */}
        <div className="app-flex-grid" style={{ width: '50%', height: '100vh', minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', boxSizing: 'border-box' }}>
          <div style={{
            width: '100%',
            aspectRatio: '1 / 1',
            background: '#f5f5f5',
            boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
            minWidth: 0,
            minHeight: 0,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative', // <-- Add this line
          }}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div ref={gridRef} style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(4, 1fr)',
              width: '100%',
              height: '100%',
              backgroundColor: safeGradientStart,
              boxSizing: 'border-box',
              gap: 0,
              overflow: 'hidden',
            }}>
              {cells}
            </div>
            {/* SVG noise overlay */}
            <svg
              width="100%"
              height="100%"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                pointerEvents: "none",
                width: "100%",
                height: "100%",
                zIndex: 2,
              }}
            >
              <defs>
                <filter id="noiseFilter">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.65"
                    numOctaves="3"
                    stitchTiles="stitch"
                  />
                </filter>
              </defs>
              <rect
                width="100%"
                height="100%"
                filter="url(#noiseFilter)"
                fill="white"
                opacity="0.12"
              />
            </svg>
          </div>
        </div>
        {/* Right: Controls Panel */}
        <div className="app-flex-controls" style={{ width: '50%', height: '100vh', minHeight: 0, maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: 0, overflow: 'auto' }}>
          <div style={{ width: '100%', aspectRatio: '1/1', display: 'flex', flexDirection: 'row', alignItems: 'stretch', justifyContent: 'stretch', padding: '2rem', overflow: 'hidden', boxSizing: 'border-box', height: '100%', maxHeight: '100%', gap: '2rem' }}>
            {/* Logo Column */}
            <div ref={logoColRef} style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', height: '100%' }}>
              <img src={imgLogo} alt="Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block', maxHeight: '100%' }} />
              {/* In the logo column, wrap both buttons in a div with 1rem gap */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
                <button onClick={randomizeGrid} style={{ width: '100%', height: 52, padding: 16, fontFamily: 'serif', fontSize: 24, fontWeight: 400, background: '#000', color: '#fff', border: 'none', borderRadius: 0, cursor: 'pointer', letterSpacing: -0.96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Randomise grid</button>
                <button onClick={generateGif} disabled={isGeneratingGif} style={{ width: '100%', height: 52, padding: 16, fontFamily: 'serif', fontSize: 24, fontWeight: 400, background: '#000', color: '#fff', border: 'none', borderRadius: 0, cursor: isGeneratingGif ? 'not-allowed' : 'pointer', opacity: isGeneratingGif ? 0.6 : 1, letterSpacing: -0.96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isGeneratingGif ? 'Generating GIF...' : 'Export GIF'}</button>
              </div>
            </div>
            {/* Controls Column */}
            <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-start', alignItems: 'stretch' }}>
              <div style={{ width: '100%', height: logoColWidth ? logoColWidth : '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'stretch', transition: 'height 0.2s' }}>
                {/* Input group */}
                <div id="input-group-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', height: '100%' }}>
                  {/* Upload image */}
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex' }}>
                    <div style={{ alignSelf: 'stretch', color: 'black', fontSize: 24, fontFamily: 'PP Editorial New, serif', fontWeight: 400, wordWrap: 'break-word' }}>Upload image</div>
                    {/* Upload image input group */}
                    <label htmlFor="image-upload" style={{ alignSelf: 'stretch', padding: 16, background: 'white', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'inline-flex', cursor: 'pointer', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <span style={{ fontFamily: 'PP Editorial New, serif', fontSize: 24, color: 'rgba(0,0,0,0.6)', width: '100%', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {imageUrl ? 'Image selected' : 'Choose file'}
                      </span>
                      <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {/* Gradient start */}
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex' }}>
                    <div style={{ alignSelf: 'stretch', color: 'black', fontSize: 24, fontFamily: 'PP Editorial New, serif', fontWeight: 400, wordWrap: 'break-word' }}>Gradient start</div>
                    <label htmlFor="gradient-start-input" style={{ alignSelf: 'stretch', padding: 16, background: 'white', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'inline-flex', cursor: 'pointer', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <span style={{ width: 20, height: 20, border: '1px solid #ccc', borderRadius: 4, background: gradientStart, marginRight: 8, display: 'inline-block', position: 'relative' }}>
                        <input id="gradient-start-input" type="color" value={gradientStart} onChange={e => setGradientStart(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', border: 'none', padding: 0, margin: 0 }} />
                      </span>
                      <div style={{ color: 'rgba(0, 0, 0, 0.60)', fontSize: 24, fontFamily: 'PP Editorial New, serif', fontWeight: 400, wordWrap: 'break-word' }}>{gradientStart}</div>
                    </label>
                  </div>
                  {/* Gradient End */}
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex' }}>
                    <div style={{ alignSelf: 'stretch', color: 'black', fontSize: 24, fontFamily: 'PP Editorial New, serif', fontWeight: 400, wordWrap: 'break-word' }}>Gradient End</div>
                    <label htmlFor="gradient-end-input" style={{ alignSelf: 'stretch', padding: 16, background: 'white', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'inline-flex', cursor: 'pointer', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <span style={{ width: 20, height: 20, border: '1px solid #ccc', borderRadius: 4, background: gradientEnd, marginRight: 8, display: 'inline-block', position: 'relative' }}>
                        <input id="gradient-end-input" type="color" value={gradientEnd} onChange={e => setGradientEnd(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', border: 'none', padding: 0, margin: 0 }} />
                      </span>
                      <div style={{ color: 'rgba(0, 0, 0, 0.60)', fontSize: 24, fontFamily: 'PP Editorial New, serif', fontWeight: 400, wordWrap: 'break-word' }}>{gradientEnd}</div>
                    </label>
                  </div>
                  {/* Circle ratio */}
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex' }}>
                    <div style={{ alignSelf: 'stretch', color: 'black', fontSize: 24, fontFamily: 'PP Editorial New, serif', fontWeight: 400, wordWrap: 'break-word' }}>Circle ratio</div>
                    <div style={{ alignSelf: 'stretch', padding: 16, background: 'white', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'inline-flex', width: '100%', boxSizing: 'border-box' }}>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={circleRatio}
                        onChange={e => setCircleRatio(parseInt(e.target.value))}
                        style={{
                          width: '100%',
                          height: 20,
                          background: 'black',
                          border: 'none',
                          outline: 'none',
                          marginRight: 8,
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          borderRadius: 0,
                          position: 'relative',
                          zIndex: 1,
                        }}
                        className="custom-slider"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Remove Export GIF button from controls column */}
              {/* Feedback */}
              {gifSuccess && gifUrl && (
                <div style={{ marginTop: 32, color: '#1a7f37', fontWeight: 500, fontSize: 16, fontFamily: 'serif', alignSelf: 'flex-start' }}>
                  GIF generated! <a href={gifUrl} download="grid-animation.gif" style={{ textDecoration: 'underline', color: '#1a4fff' }}>Click here to download</a>
        </div>
      )}
      {gifError && (
                <div style={{ marginTop: 32, color: '#c0392b', fontWeight: 500, fontSize: 16, fontFamily: 'serif', alignSelf: 'flex-start' }}>{gifError}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
