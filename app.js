// app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- UI-Elemente und globale Variablen (unverändert) ---
    // ...

    // --- Visualisierung ---
    const draw = () => {
        // --- ✅ NEUE, LOGISCHE ZEICHENFUNKTION ---
        
        // 1. Grundeinstellungen und Skalierung
        // Wir definieren die Welt in Metern. Der Korridor ist ca. 4x4 Meter groß.
        const worldSize = 4.0; 
        const scale = CONFIG.CANVAS_SIZE / worldSize;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#2a2a2a'; // Wandfarbe
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 2. Zeichne den Korridor
        const corridorWidthMeters = 1.0;
        const corridorArmLengthMeters = 3.0;
        
        // Skaliere die Meter-Angaben in Pixel
        const corridorWidthPx = corridorWidthMeters * scale;
        const corridorArmLengthPx = corridorArmLengthMeters * scale;
        
        // Zeichne den freien Pfad
        ctx.fillStyle = '#000000'; // Wegfarbe
        // Vertikaler Arm (von A)
        ctx.fillRect(0, 0, corridorWidthPx, corridorArmLengthPx);
        // Horizontaler Arm (nach B)
        ctx.fillRect(0, corridorArmLengthPx - corridorWidthPx, corridorArmLengthPx, corridorWidthPx);

        // 3. Beschrifte Start (A) und Ziel (B)
        ctx.fillStyle = "white";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("A", corridorWidthPx / 2, 25);
        ctx.fillText("B", corridorArmLengthPx - 20, corridorArmLengthPx - (corridorWidthPx / 2) + 8);

        // 4. Zeichne das Sofa in seiner Bewegung von A nach B
        const sofaShapeData = Sofa.getShape(CONFIG.RENDER_RESOLUTION);
        if (!sofaShapeData) return;

        const sofaBaseCanvas = document.createElement('canvas');
        sofaBaseCanvas.width = CONFIG.RENDER_RESOLUTION;
        sofaBaseCanvas.height = CONFIG.RENDER_RESOLUTION;
        const sofaBaseCtx = sofaBaseCanvas.getContext('2d');
        const imageData = sofaBaseCtx.createImageData(CONFIG.RENDER_RESOLUTION, CONFIG.RENDER_RESOLUTION);

        for (let i = 0; i < sofaShapeData.length; i++) {
            const a = sofaShapeData[i] * 255;
            imageData.data[i*4]=0; imageData.data[i*4+1]=123; imageData.data[i*4+2]=255; imageData.data[i*4+3]=a;
        }
        sofaBaseCtx.putImageData(imageData, 0, 0);

        const visualizationSteps = 5;
        for (let i = 0; i <= visualizationSteps; i++) {
            const t = i / visualizationSteps; // Fortschritt von 0 (bei A) bis 1 (bei B)
            
            // Simuliere die Bewegung: erst runter, dann um die Ecke, dann nach rechts
            const angle = -Math.PI / 2 * Math.min(1, t * 2); // Dreht sich in der ersten Hälfte
            const xPos = Math.max(0, t * 2 - 1) * (corridorArmLengthMeters - corridorWidthMeters);
            const yPos = Math.min(t * 2, 1) * (corridorArmLengthMeters - corridorWidthMeters);

            ctx.save();
            // Bewege den Canvas zum aktuellen Punkt der Reise
            ctx.translate(xPos * scale, yPos * scale);
            ctx.rotate(angle);
            
            // Zentriere das Sofa um seinen Drehpunkt
            ctx.translate(-worldSize/2 * scale, -worldSize/2 * scale);
            
            ctx.globalAlpha = 0.4;
            ctx.imageSmoothingEnabled = false;
            // Zeichne das Sofa-Bild skaliert auf die Weltgröße
            ctx.drawImage(sofaBaseCanvas, 0, 0, worldSize * scale, worldSize * scale);
            ctx.restore();
        }
    };

    // --- Rest von app.js (main, optimizationLoop etc.) bleibt unverändert ---
    // ...
};
