/* THREEJS RENDERER — Layer 4 (COMPOSITION).
 *
 * Canvas 2D overlay layer for UI chrome, typography, and final composite.
 * This layer sits on top of all procedural layers and is where editorial
 * type rendering happens. Future support for compositing other elements
 * (captions, credits, watermarks, interactive UI).
 *
 * Layer 4 (COMPOSITION): Canvas 2D overlay, final composite, UI chrome
 *
 * Orchestrates the multi-pass rendering pipeline and handles the final
 * output to Canvas 2D context for display and export.
 */

/**
 * Initialize composition layer with Canvas 2D context for overlay.
 * Returns a render function that composites all layers.
 */
export function initCompositionLayer(canvas, ctx, config) {
  return {
    // Composite all layers into the canvas context
    render(groundPixels, imageryPixels) {
      return compositeAllLayers(ctx, canvas, groundPixels, imageryPixels, config);
    },
    // Add typography/captions overlay
    renderText(text, position, style) {
      return renderTextOverlay(ctx, canvas, text, position, style);
    },
    // Add UI chrome (credits, watermarks, etc.)
    renderChrome(elements) {
      return renderChrome(ctx, canvas, elements);
    },
  };
}

/**
 * Composite all rendering layers into final output.
 * Order: Imagery (back) → Ground → Text → Chrome (front)
 */
function compositeAllLayers(ctx, canvas, groundPixels, imageryPixels, config) {
  // Ground layer (from WebGL)
  if (groundPixels) {
    const imageData = new ImageData(groundPixels, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Imagery composite (when enabled)
  if (imageryPixels && config?.includeImageryLayer) {
    // TODO: Apply blend mode and composite imagery
    // Once imagery.js is fully integrated, composite here
  }

  // Text overlays and chrome are rendered directly to ctx
  // (see renderTextOverlay and renderChrome below)
}

/**
 * Render typography overlay on the composed frame.
 * Positions text at the specified location with the given styling.
 */
function renderTextOverlay(ctx, canvas, text, position, style) {
  const {
    font = '16px "Space Grotesk"',
    color = "#000",
    maxWidth = canvas.width - 40,
    textAlign = "left",
    lineHeight = 1.4,
    opacity = 1,
  } = style;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = textAlign;

  // Handle line breaks and word wrapping
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeightPx = parseInt(font) * lineHeight;

  lines.forEach((line, i) => {
    const y = position.y + i * lineHeightPx;
    ctx.fillText(line, position.x, y);
  });

  ctx.restore();
}

/**
 * Word-wrap text to fit within a maximum width.
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Render UI chrome elements (credits, watermarks, info, etc.).
 * Elements array: [{ type, text, position, style }]
 */
function renderChrome(ctx, canvas, elements) {
  if (!elements || elements.length === 0) return;

  elements.forEach((element) => {
    switch (element.type) {
      case "credit":
        renderCredit(ctx, canvas, element);
        break;
      case "watermark":
        renderWatermark(ctx, canvas, element);
        break;
      case "info":
        renderInfo(ctx, canvas, element);
        break;
      case "corner-mark":
        renderCornerMark(ctx, canvas, element);
        break;
    }
  });
}

function renderCredit(ctx, canvas, element) {
  const { text, position = "bottom-right", style = {} } = element;
  const defaultStyle = {
    font: '12px "Newsreader"',
    color: "rgba(0,0,0,0.6)",
    position: { x: canvas.width - 10, y: canvas.height - 10 },
    textAlign: "right",
    opacity: 0.7,
  };
  const finalStyle = { ...defaultStyle, ...style, position: style.position || {} };
  renderTextOverlay(ctx, canvas, text, finalStyle.position, finalStyle);
}

function renderWatermark(ctx, canvas, element) {
  const { text, position = "center", style = {} } = element;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const defaultStyle = {
    font: 'bold 24px "Archivo Black"',
    color: "rgba(0,0,0,0.1)",
    position: { x: centerX, y: centerY },
    textAlign: "center",
    opacity: 0.15,
  };
  const finalStyle = { ...defaultStyle, ...style };
  renderTextOverlay(ctx, canvas, text, finalStyle.position, finalStyle);
}

function renderInfo(ctx, canvas, element) {
  const { text, position = "top-left", style = {} } = element;
  const defaultStyle = {
    font: '14px "JetBrains Mono"',
    color: "rgba(0,0,0,0.8)",
    position: { x: 10, y: 20 },
    textAlign: "left",
    opacity: 0.9,
  };
  const finalStyle = { ...defaultStyle, ...style, position: style.position || {} };
  renderTextOverlay(ctx, canvas, text, finalStyle.position, finalStyle);
}

function renderCornerMark(ctx, canvas, element) {
  const { text, corner = "top-left", style = {} } = element;
  const positions = {
    "top-left": { x: 8, y: 16 },
    "top-right": { x: canvas.width - 8, y: 16 },
    "bottom-left": { x: 8, y: canvas.height - 8 },
    "bottom-right": { x: canvas.width - 8, y: canvas.height - 8 },
  };
  const defaultStyle = {
    font: '11px "JetBrains Mono"',
    color: "rgba(0,0,0,0.7)",
    textAlign: corner.includes("right") ? "right" : "left",
    opacity: 0.8,
  };
  const finalStyle = { ...defaultStyle, ...style };
  renderTextOverlay(ctx, canvas, text, positions[corner], finalStyle);
}

/**
 * Orchestration: render all layers and composite them.
 * Called from the main render loop once per frame.
 */
export function renderComposite(ctx, canvas, groundPixels, imageryPixels, textElements, chromeElements, config) {
  // Composite background layers (ground + imagery)
  compositeAllLayers(ctx, canvas, groundPixels, imageryPixels, config);

  // Render text overlays (captions, narration, etc.)
  if (textElements && textElements.length > 0) {
    textElements.forEach((element) => {
      renderTextOverlay(ctx, canvas, element.text, element.position, element.style);
    });
  }

  // Render UI chrome (credits, watermarks, info)
  if (chromeElements && chromeElements.length > 0) {
    renderChrome(ctx, canvas, chromeElements);
  }
}
