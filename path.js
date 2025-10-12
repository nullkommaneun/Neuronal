// path.js (Stable, Non-AI version)
const Path = {
    getPointOnPath: function(progress) {
        let xPos, yPos, rotation;
        const cornerCenter = { x: Corridor.width, y: Corridor.width };
        const radius = Corridor.width / 2;

        if (progress < 0.333) { // 1. Anfahrt zur Kurve
            const phaseProgress = progress / 0.333;
            xPos = radius;
            // ✅ KORREKTUR: Der Pfad startet jetzt bei y=radius (0.5m)
            // und bewegt sich von dort zur Ecke.
            yPos = radius + (phaseProgress * (cornerCenter.y - radius));
            rotation = 0;
        } else if (progress < 0.666) { // 2. Die Kurve
            const phaseProgress = (progress - 0.333) / 0.333;
            const angle = (Math.PI / 2) * phaseProgress;
            xPos = cornerCenter.x - Math.cos(angle) * radius;
            yPos = cornerCenter.y + Math.sin(angle) * radius;
            rotation = angle;
        } else { // 3. Wegfahrt von der Kurve
            const phaseProgress = (progress - 0.666) / 0.333;
            xPos = cornerCenter.x + radius + (phaseProgress * (Corridor.armLength - cornerCenter.x - radius));
            yPos = cornerCenter.y + radius;
            rotation = Math.PI / 2;
        }
        return { x: xPos, y: yPos, rotation: rotation };
    }
};
