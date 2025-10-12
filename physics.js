/**
 * @file physics.js
 * @description Die unbestechliche Physik-Engine.
 * Sie validiert jeden einzelnen Schritt und verhindert das Durchdringen von Wänden.
 */
const Physics = {
    sofaState: { x: 0, y: 0, rotation: 0 },
    currentWaypointIndex: 0,

    init: function(initialSofa) {
        this.sofaState.x = initialSofa.x;
        this.sofaState.y = initialSofa.y;
        this.sofaState.rotation = initialSofa.rotation;
        this.currentWaypointIndex = 0;
    },

    simulateStep: function(sofaTemplate, proposedWaypoints) {
        if (this.currentWaypointIndex >= proposedWaypoints.length - 1) {
            // Die Animation des aktuellen Plans ist am Ende, starte von vorn.
            this.currentWaypointIndex = 0;
            // Setze das Sofa für den neuen Animationszyklus auf den Startpunkt des Plans zurück.
            this.sofaState.x = proposedWaypoints[0].x;
            this.sofaState.y = proposedWaypoints[0].y;
            this.sofaState.rotation = proposedWaypoints[0].rotation;
            return;
        }

        const nextProposedState = proposedWaypoints[this.currentWaypointIndex + 1];
        const ghostSofa = createSofa(sofaTemplate.width, sofaTemplate.height);
        ghostSofa.setPosition(nextProposedState.x, nextProposedState.y, nextProposedState.rotation);

        // Der Schiedsrichter-Check:
        if (Corridor.calculateCollisionLoss(ghostSofa) > 0.01) {
            // FOUL! Bewegung verweigert. Das Sofa bewegt sich nicht.
            // Wir springen trotzdem zum nächsten geplanten Punkt in der Animation,
            // um zu zeigen, wo der Plan der KI fehlschlägt.
            this.currentWaypointIndex++;
        } else {
            // Legal. Der Schritt ist erlaubt. Aktualisiere den wahren Zustand.
            this.sofaState.x = nextProposedState.x;
            this.sofaState.y = nextProposedState.y;
            this.sofaState.rotation = nextProposedState.rotation;
            this.currentWaypointIndex++;
        }
    }
};
