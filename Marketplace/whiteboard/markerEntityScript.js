//
//  markerTipEntityScript.js
//
//  Created by Eric Levin on 2/17/15.
//  Additions by James B. Pollack @imgntn 6/9/2016
//  Modifications by Thijs Wenker @thoys 1/19/2017
//  Copyright 2017 High Fidelity, Inc.
//
//  This script provides the logic for an object to draw marker strokes on its associated whiteboard

//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

(function() {

    Script.include(Script.resolvePath('utils.js'));
    //var SPRING_ENTITY_SCRIPT_URL = Script.resolvePath('springentity.js');
    var MAX_POINTS_PER_STROKE = 40;
    var DEFAULT_COLOR = {
        red: 10,
        green: 10,
        blue: 10
    };
    // var LINEAR_TIMESCALE = 0.1;
    // var ANGULAR_TIMESCALE = 0.1;
    var _this;
	
	var isPainting = false;

    // subscribe to channel 
    MarkerTip = function() {
        _this = this;
        _this.MARKER_TEXTURE_URL = Script.resolvePath("markerStroke.png");
        _this.strokeForwardOffset = 0.0001;
        _this.STROKE_WIDTH_RANGE = {
            min: 0.002,
            max: 0.01
        };
        _this.MIN_DISTANCE_BETWEEN_POINTS = 0.002;
        _this.MAX_DISTANCE_BETWEEN_POINTS = 0.1;
        _this.strokes = [];
        _this.STROKE_NAME = "hifi_polyline_markerStroke";
        _this.WHITEBOARD_SURFACE_NAME = "Whiteboard - Drawing Surface";
        _this.MARKER_COLOR_NAME = "hifi-whiteboardPaint";
    };


    function handleColorMessage(channel, message, senderID) {
        if(channel == "Ink-Color") {
            setEntityCustomData("markerColor", _this.entityID, JSON.parse(message))
        }
    };

    Messages.subscribe("Ink-Color");
    Messages.messageReceived.connect(handleColorMessage);

    MarkerTip.prototype = {

        springAction: null,
        springEntity: null,
        hand: null,

        preload: function(entityID) {
            this.entityID = entityID;
        },

        startNearGrab: function() {
            _this.whiteboards = [];
            _this.colors = [];

            _this.markerColor = getEntityUserData(_this.entityID).markerColor;

            var markerProps = Entities.getEntityProperties(_this.entityID);
            _this.DRAW_ON_BOARD_DISTANCE = markerProps.dimensions.z / 2;
            var markerPosition = markerProps.position;
            var results = Entities.findEntities(markerPosition, 5);
            results.forEach(function(entity) {
                var entityName = Entities.getEntityProperties(entity, "name").name;
                if (entityName === _this.WHITEBOARD_SURFACE_NAME) {
                    _this.whiteboards.push(entity);
                } else if (entityName === _this.MARKER_COLOR_NAME) {
                    _this.colors.push(entity)
                }
            });
        },

        releaseGrab: function() {
            _this.resetStroke();
        },

        continueNearGrab: function(ID, paramsArray) {
            // cast a ray from marker and see if it hits anything
            var markerProps = Entities.getEntityProperties(_this.entityID);

            //need to back up the ray to the back of the marker 

            var markerFront = Quat.getFront(markerProps.rotation);
            var howFarBack = markerProps.dimensions.z / 2;
            var pulledBack = Vec3.multiply(markerFront, -howFarBack);
            var backedOrigin = Vec3.sum(markerProps.position, pulledBack);

            var pickRay = {
                origin: backedOrigin,
                direction: Quat.getFront(markerProps.rotation)
            };

            var colorIntersection = Entities.findRayIntersection(pickRay, true, _this.colors);

			var isIntersectingColorWell = false;
			
            if (colorIntersection.intersects) {
				
				_this.colors.forEach(function(entity) {
					if (entity === colorIntersection.entityID) {
						isIntersectingColorWell = true;
					}
				});
				if (isIntersectingColorWell) {
					_this.markerColor = getEntityCustomData('markerColor', colorIntersection.entityID, DEFAULT_COLOR);
					setEntityCustomData('markerColor', _this.entityID, _this.markerColor);
				} else {
					// update color
                    _this.markerColor = getEntityCustomData('markerColor', _this.entityID, DEFAULT_COLOR);
				}
				
            } else {
                // update color
                _this.markerColor = getEntityCustomData('markerColor', _this.entityID, DEFAULT_COLOR);
            }

            var whiteBoardIntersection = Entities.findRayIntersection(pickRay, true, _this.whiteboards);
            if (whiteBoardIntersection.intersects && Vec3.distance(whiteBoardIntersection.intersection, markerProps.position) <= _this.DRAW_ON_BOARD_DISTANCE) {
                _this.currentWhiteboard = whiteBoardIntersection.entityID;
                var whiteboardRotation = Entities.getEntityProperties(_this.currentWhiteboard, "rotation").rotation;
                _this.whiteboardNormal = Quat.getFront(whiteboardRotation);
                _this.paint(whiteBoardIntersection.intersection);
                isPainting = true;
                hand = paramsArray[0] === 'left' ? 0 : 1;
                var vibrated = Controller.triggerHapticPulse(1, 70, hand);
            } else {
                _this.resetStroke();
            }
        },
        startEquip: function() {
            _this.startNearGrab();
        },
        continueEquip: function(ID, paramsArray) {
            _this.continueNearGrab(ID, paramsArray);
        },
        releaseEquip: function() {
             _this.releaseGrab();
        },
        paint: function(position) {
            //[position, markerColor, creatorMarker, parentID]
            // Paint
			// whiteboard server ID
			var serverID = Entities.getEntityProperties(_this.currentWhiteboard, "parentID").parentID;
			print("Daantje Debug + call server paint " + serverID);
            Entities.callEntityServerMethod(serverID, 'paint', [JSON.stringify(position), JSON.stringify(_this.markerColor), _this.entityID, _this.currentWhiteboard]);
        },
        resetStroke: function() {
            // reset stroke
            //[creatorMarker, parentID]
			if (isPainting) {
				isPainting = false;
				var serverID = Entities.getEntityProperties(_this.currentWhiteboard, "parentID").parentID;
			    print("Daantje Debug + call server reset " + serverID);
                Entities.callEntityServerMethod(serverID, 'resetMarkerStroke', [_this.entityID, _this.currentWhiteboard]);
			}
        }
    };

    return new MarkerTip();
});

//  markerTipEntityScript.js
//
//  Created by Eric Levin on 2/17/15.
//  Additions by James B. Pollack @imgntn 6/9/2016
//  Modifications by Thijs Wenker @thoys 1/19/2017
//  Copyright 2017 High Fidelity, Inc.
//
//  This script provides the logic for an object to draw marker strokes on its associated whiteboard

//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//  markerTipEntityScript.js
//
//  Created by Eric Levin on 2/17/15.
//  Additions by James B. Pollack @imgntn 6/9/2016
//  Modifications by Thijs Wenker @thoys 1/19/2017
//  Copyright 2017 High Fidelity, Inc.
//
//  This script provides the logic for an object to draw marker strokes on its associated whiteboard

//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//  markerTipEntityScript.js
//
//  Created by Eric Levin on 2/17/15.
//  Additions by James B. Pollack @imgntn 6/9/2016
//  Modifications by Thijs Wenker @thoys 1/19/2017
//  Copyright 2017 High Fidelity, Inc.
//
//  This script provides the logic for an object to draw marker strokes on its associated whiteboard

//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html