// path.js (Stable, Non-AI version)
const Path = {
    /**
     * Calculates a point on a smooth, curved path from A to B.
     * @param {number} progress - A value from 0 (start) to 1 (end).
     * @returns {{x: number, y: number, rotation: number}} - The position and rotation.
     */
    getPointOnPath: function(progress) {
        let xPos, yPos, rotation;
        const cornerCenter = { x: Corridor.width, y: Corridor.width };
        const radius = Corridor.width / 2;

        if (progress < 0.333) { // 1. Approach curve
            const phaseProgress = progress / 0.333;
            xPos = radius;
            yPos = phaseProgress * cornerCenter.y;
            rotation = 0;
        } else if (progress < 0.666) { // 2. The curve
            const phaseProgress = (progress - 0.333) / 0.333;
            const angle = (Math.PI / 2) * phaseProgress;
            xPos = cornerCenter.x - Math.cos(angle) * radius;
            yPos = cornerCenter.y + Math.sin(angle) * radius;
            rotation = angle;
        } else { // 3. Exit curve
            const phaseProgress = (progress - 0.666) / 0.333;
            xPos = cornerCenter.x + radius + (phaseProgress * (Corridor.armLength - cornerCenter.x - radius));
            yPos = cornerCenter.y + radius;
            rotation = Math.PI / 2;
        }
        return { x: xPos, y: yPos, rotation: rotation };
    }
};
