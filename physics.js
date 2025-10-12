/**
 * @file physics.js
 * @description Die unbestechliche Physik-Engine.
 * Sie validiert jeden einzelnen Schritt und verhindert das Durchdringen von Wänden.
 */
const Physics = {
    // Speichert den einzig wahren, physikalisch korrekten Zustand des Sofas.
    sofaState: { x: 0, y: 0, rotation: 0 },
    
    // Der aktuelle Index im Pfad der KI.
    currentWaypointIndex: 0,

    /**
     * Initialisiert die Physik-Engine mit dem Startzustand.
     * @param {object} initialSofa - Das Start-Sofa-Objekt.
     */
    init: function(initialSofa) {
        this.sofaState.x = initialSofa.x;
        this.sofaState.y = initialSofa.y;
        this.sofaState.rotation = initialSofa.rotation;
        this.currentWaypointIndex = 0;
    },

    /**
     * Führt einen einzelnen, physikalisch validierten Schritt aus.
     * @param {Array<object>} proposedWaypoints - Der vollständige Pfad, den die KI vorschlägt.
     */
    simulateStep: function(sofaTemplate) {
        if (this.currentWaypointIndex >= proposedWaypoints.length - 1) {
            // Die KI hat das Ende ihres Plans erreicht.
            // Für die nächste Runde fängt die Animation wieder von vorne an.
            this.currentWaypointIndex = 0;
        }

        const nextProposedState = proposedWaypoints[this.currentWaypointIndex + 1];

        // Erstelle ein "Geister-Sofa" am vorgeschlagenen nächsten Ort.
        const ghostSofa = createSofa(sofaTemplate.width, sofaTemplate.height);
        ghostSofa.setPosition(nextProposedState.x, nextProposedState.y, nextProposedState.rotation);

        // DER KERN: Der Schiedsrichter-Check.
        if (Corridor.calculateCollisionLoss(ghostSofa) > 0.01) {
            // FOUL! Die Bewegung führt zu einer Kollision.
            // Die Bewegung wird VERWEIGERT. Das Sofa bleibt, wo es ist.
            // Wir erhöhen den Index trotzdem, damit die Animation nicht für immer hängt.
            this.currentWaypointIndex++;
            return; // Nichts ändert sich.
        } else {
            // Legal. Der Schritt ist erlaubt.
            // Aktualisiere den wahren Zustand des Sofas.
            this.sofaState.x = nextProposedState.x;
            this.sofaState.y = nextProposedState.y;
            this.sofaState.rotation = nextProposedState.rotation;
            this.currentWaypointIndex++;
        }
    }
};
