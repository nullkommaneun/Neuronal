// path.js (Ultra-Stable, Linear Path)
const Path = {
    getPointOnPath: function(progress, sofa) {
        let xPos, yPos, rotation;
        const cornerY = Corridor.armLength - Corridor.width / 2;
        const cornerX = Corridor.width / 2;

        // Der Pfad ist in 3 simple Phasen unterteilt: runter, drehen, rechts
        if (progress < 0.45) { // Phase 1: Geradeaus nach unten
            const phaseProgress = progress / 0.45;
            xPos = Corridor.width / 2;
            // Startet bei der sicheren Sofa-Position und bewegt sich zur Ecke
            yPos = (sofa.height / 2) + (phaseProgress * (cornerY - sofa.height / 2));
            rotation = 0;
        } else if (progress < 0.55) { // Phase 2: Kurze Drehung
            const phaseProgress = (progress - 0.45) / 0.10;
            xPos = cornerX;
            yPos = cornerY;
            rotation = (Math.PI / 2) * phaseProgress;
        } else { // Phase 3: Geradeaus nach rechts
            const phaseProgress = (progress - 0.55) / 0.45;
            xPos = cornerX + (phaseProgress * (Corridor.armLength - cornerX));
            yPos = cornerY;
            rotation = Math.PI / 2;
        }
        return { x: xPos, y: yPos, rotation: rotation };
    }
};
