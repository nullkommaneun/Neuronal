// corridor.js
const Corridor = {
    width: 1.0,
    armLength: 3.0,

    isInside: function(x, y) {
        if (x < 0 || y < 0 || x > this.armLength || y > this.armLength) return false;
        if (x > this.width && y > this.width) return false;
        return true;
    },

    checkCollision: function(sofa) {
        const corners = sofa.getCorners();
        for (const corner of corners) {
            if (!this.isInside(corner.x, corner.y)) {
                return true; // Collision!
            }
        }
        return false;
    }
};
