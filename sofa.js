// sofa.js

const Sofa = {
    // ... (init und trainStep bleiben unverändert) ...

    /**
     * Gibt die aktuelle Form des Sofas als Datenarray für die Visualisierung zurück.
     * @param {number} resolution - Die Auflösung des Rasters für die Darstellung.
     * @returns {Float32Array | null}
     */
    getShape: function(resolution) {
        if (!this.model) return null;
        
        return tf.tidy(() => {
            // ✅ NEU: Die Skala wird von 2.5 auf 4.0 erhöht, um in den neuen Korridor zu passen.
            const grid = this._createGrid(resolution, 4.0); 
            return this.model.predict(grid).dataSync();
        });
    },

    // --- Private Hilfsfunktionen ---
    _createGrid: (resolution, scale) => {
        // ... (unverändert) ...
    },
    _transformPoints: (points, angle, dx, dy) => {
        // ... (unverändert) ...
    }
};
