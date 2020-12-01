window.TimeMapUtilities = {
    getBoundengRectOffset: function (elementId) {
        const rect = document.getElementById(elementId).getBoundingClientRect();
        return {
            left: rect.left + window.scrollX,
            top: rect.top + window.scrollY
        };
    },
    saveAsFile: function (filename, bytesBase64) {
        var newfilename = prompt("Please enter a file name", filename);
        if (newfilename) {
            var link = document.createElement('a');
            link.download = newfilename + ".json";
            link.href = "data:application/octet-stream;base64," + bytesBase64;
            document.body.appendChild(link); // Needed for Firefox
            link.click();
            document.body.removeChild(link);
            DotNet.invokeMethod("MapMyTime", "UpdateText", 0, newfilename);
        }
    },
    openURL: function () {
        return prompt("Enter a link to Json file to dowload", "https://MapMyTime/MapMyTime.json");
    },
    cursorStyle: function (style) {
        document.body.style.cursor = style;
    },
    runFileInput: function (element) {

        //element.value = "";
        fileInput.click();
        //element.click();
    },
    alertMessage: function (message) {
        alert(message);
    },
    unsavedChangesOK: function () {
        if (window.mapHasChanged) {
            return confirm("You have unsaved changes, do you want to continue?");
        }
        return true;
    },
    updateURLwithoutReload: function (newURL) {
        window.history.pushState("data", "Map My Time", newURL);
    },
};

(function () {
    window.blazorLocalStorage = {
        get: key => key in localStorage ? JSON.parse(localStorage[key]) : null,
        set: (key, value) => { localStorage[key] = JSON.stringify(value); },
        delete: key => { delete localStorage[key]; }
    };
})();

window.D3TimeMapUtilities = {
    positionIcons: function () {
        var svgDoc = document.getElementById("svg")
        if (svgDoc) {
            var boundingClient = svgDoc.getBoundingClientRect();
            var saveIcon = document.getElementById("saveIcon");
            var saveIconRect = saveIcon.getBoundingClientRect();
            var pt = svgDoc.createSVGPoint();
            pt.y = boundingClient.top + 4;
            pt.x = boundingClient.right - saveIconRect.width - 4;
            saveIcon.setAttribute("x", pt.matrixTransform(svgDoc.getScreenCTM().inverse()).x);
            saveIcon.setAttribute("y", pt.matrixTransform(svgDoc.getScreenCTM().inverse()).y);
            if (window.touchTrigger) {
                let zoomTransform = d3.zoomTransform(svgDoc);
                let centreX = zoomTransform.x + (window.touchedData.x0 * zoomTransform.k) + (boundingClient.width / 2);
                let centreY = zoomTransform.y + (window.touchedData.y0 * zoomTransform.k) + (boundingClient.width / 2);
                d3.select("topGroup").transition()
                    .duration(500)
                    .attr("transform", "translate(" + centreX + "," + centreY + ") scale(" + zoomTransform.k + ")");
                window.touchTrigger = false;
            }
        }
        window.D3TimeMapUtilities.setSmallScreen();
    },
    setSmallScreen: function () {
        if (document.body.clientWidth < 768) { window.isScreenSmall = true; }
        else { window.isScreenSmall = false; }
    },
    isFirstVisit: function () {
        return (window.D3TimeMapUtilities.getCookie("firstvisit") != "") ? false : true;
    },
    setFirstVisit: function () {
        window.D3TimeMapUtilities.setCookie("firstvisit", true, 90);
    },
    getCookie: function (cname) {
        var name = cname + "=";
        var decodedCookie = decodeURIComponent(document.cookie);
        var ca = decodedCookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    },
    setCookie: function (cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    },
    createD3Tree: function (jsonTimeMapData) {

        var root = d3.hierarchy(JSON.parse(jsonTimeMapData));
        const duration = event && event.altKey ? 2500 : 250;

        var diagonal = d3.linkHorizontal()
            .x(function (d) {
                return d.X ?? d.x;
            })
            .y(function (d) {
                return d.Y ?? d.y;
            });
        const viewboxx = 700, viewboxy = 700;


        setRootDataXandYCoords(root); //TODO - can we do this better

        window.mapHasChanged = false;
        //Map variables
        var isNewMap;
        var defaultheight;
        var defaultwidth;
        var proximityrectwidth;
        var proximityrectheight;
        var defaultfontsize;
        var highlightrectboundary;
        var isTap = false;
        var editingNode = "";
        var touchposition;
        var defaultnodetext;
        var contextmenuitems;
        var nodemenu;
        //Dragging vars
        var dragWithCtlKey = false;
        var isLongTouch = false;
        var hasBeenDragged = false;
        var flexdivdragging = false;
        var groupdragx;
        var groupdragy;
        var dragTimer;
        var throttledDragNode = _.throttle(dragNode, 16);

        const svgMain = d3.create("svg")
            .attr("id", "svg")
            .attr("viewBox", [0, 0, viewboxx, viewboxy])
            .style("font", root.data.fontsizepx + "px sans-serif")
            .style("user-select", "none")
            .on("click", function (event) {
                if (editingNode !== "") {
                    document.getElementById(editingNode).blur();
                    return;
                }
                var mouseposition = d3.pointer(event, document.getElementsByTagName("g")[0]);
                event.stopPropagation();
                let parentnode = d3.select(".show");
                var parentnodeid = 0;
                if (!parentnode.empty()) {
                    parentnodeid = parentnode.datum().data.nodeid;
                }
                createNewNode(parentnodeid, mouseposition);
            })
            .on("touchstart", function (event) {
                touchposition = d3.pointers(event, document.getElementsByTagName("g")[0])
                if (event.targetTouches.length === 1 && (event.srcElement.id.includes("svg") || event.srcElement.id.includes("proximityrect"))) {
                    isTap = true;
                }
                if (event.target.localName !== "input") {
                    event.preventDefault();
                }              
            })
            .on("touchmove", function () {
                isTap = false;
            })
            .on("touchend", function (event) {
                if (isTap) {
                    var parentnodeid = 0;
                    if (event.changedTouches[0].target.id.includes("proximityrect")) {
                        let proximalnodeid = d3.select(event.changedTouches[0].target).datum().data.nodeid;
                        parentnodeid = invokeDotNetMethod(window.mapHasChanged, "GetParentNodeIdFromProximalNode", proximalnodeid, touchposition[0]);
                    }
                    createNewNode(parentnodeid, touchposition[0]);
                    isTap = false;
                }
                if (event.target.localName !== "input") {
                    event.preventDefault();
                    document.activeElement.blur();
                }
            });

        svgMain.append("filter")
            .attr("id", "deletenodefilter")
            .append("feGaussianBlur")
            .attr("stdDeviation", "5");
        svgMain.append("filter")
            .attr("id", "makebrighterfilter")
            .append("feColorMatrix")
            .attr("type", "matrix")
            .attr("values", "1.2 0 0 0 0 0 1.2 0 0 0 0 0 1.2 0 0 0 0 0 1 0");
        svgMain.append("filter")
            .attr("id", "redfilter")
            .append("feColorMatrix")
            .attr("type", "matrix")
            .attr("values", "0 0 0 1 0 0 0 0 0 0 1 1 1 0 0 0 0 0 1.5 0");

        const svgGroup = svgMain.append("g")
            .attr("fill", "none")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("id", "topGroup")
            .attr("class", "topGroup")
            .on("mouseleave", function () {
                var showing = d3.selectAll(".show");
                if (!showing.empty()) {
                    showing.classed("show", false);
                }
            });

        var zoom = d3.zoom()
            .clickDistance(10)
            .on("zoom", function (event) {
                if (!flexdivdragging) {
                    if (event.target.nodeName !== "PATH") {
                        svgGroup.attr("transform", event.transform);
                    }
                }
            })
            .on("end", function (event) {
                if (!flexdivdragging) {
                    if (event.target.nodeName !== "PATH") {
                        if (!(event.transform.k === 1 &&
                            event.transform.x === 0 &&
                            event.transform.y === 0)) {
                            invokeDotNetMethod(true, "UpdateTranslation", event.transform);
                            root.data.scale = event.transform.k;
                        }
                    }
                }
            });

        svgMain.call(zoom).on("dblclick.zoom", null);

        const proximityRect = svgGroup.append("g")
            .attr("id", "proximityrect");

        const gLink = svgGroup.append("g")
            .attr("id", "linkgroup")
            .attr("class", "glink");

        const gNode = svgGroup.append("g")
            .attr("id", "nodegroup");

        const lumpNodes = svgGroup.append("g")
            .attr("id", "lumpgroup");

        nodeDragListener =
            d3.drag()
            .filter(true)
            .on("start", function (event, d) {                   
                    flexdivdragging = true;
                    hasBeenDragged = false;
                    initialX = d.x;
                    initialY = d.y;
                    if (event.sourceEvent.ctrlKey || event.sourceEvent.metaKey || isLongTouch) {
                        setUpMultiNodeDrag(d);
                    }
                    event.sourceEvent.stopPropagation();
                })
            .on("drag", function (event, d) {              
                window.touchTrigger = false;
                if (!flexdivdragging) {
                    return;
                }
                if (!hasBeenDragged) {
                    removeAllNodeContextMenus();
                    hasBeenDragged = true;
                }

                d.x += event.dx;
                d.y += event.dy;

                throttledDragNode(d);
                
            })
                .on("end", function (event, d) {
                    d3.selectAll(".highlightRect").classed("show", false);
                    if (!flexdivdragging) {
                        return;
                    }
                    flexdivdragging = false;
                    if (!hasBeenDragged && !dragWithCtlKey) {
                        return;
                    }
                    if (!hasBeenDragged && dragWithCtlKey) {
                        d.descendants().forEach((descendant) => {
                            gLink.append(function () {
                                return d3.select("#gpathlink-" + descendant.data.parentNodeId + "-" + descendant.data.nodeid).remove().node();
                            });
                            gNode.append(function () {
                                return d3.select("#node" + descendant.data.nodeid).remove().node();
                            });
                        });
                        dragWithCtlKey = false;
                        return;
                    }
                    hasBeenDragged = false;
                    d.data.xCoordinate = d.x0 = d.x;
                    d.data.yCoordinate = d.y0 = d.y;
                    let nodeLocation = invokeDotNetMethod(true, "UpdateImpactedNode", d.data.nodeid, d.x, d.y, true);
                    d.data.midpointconnections = nodeLocation.midpointconnections;
                    d.data.parentNodeConnection = nodeLocation.parentnodeconnection;
                    d.data.connection = nodeLocation.connection;
                    if (d.data.parentNodeId === 0) {
                        d3.select("#linklump" + d.data.nodeid)
                            .attr("transform", () => `translate(${d.x + (d.data.width / 2) - 4}, ${d.y - 8})`);
                    }
                    else {
                        d3.select("#linkborder-" + d.data.parentNodeId + "-" + d.data.nodeid)
                            .attr("d", () => diagonal({ source: nodeLocation.linkendpoints[0], target: nodeLocation.linkendpoints[1] }));
                    }
                    if (dragWithCtlKey) {
                        d3.select("#node" + d.data.nodeid).attr("cursor", "wait");
                        var draggednodes = [];
                        d.descendants().forEach((descendant) => {
                            draggednodes.push(descendant.data.nodeid);
                            if (d.data.nodeid != descendant.data.nodeid) {
                                descendant.x = descendant.data.xCoordinate += (d.x - initialX);
                                descendant.y = descendant.data.yCoordinate += (d.y - initialY);
                                let nodeLocation = invokeDotNetMethod(true, "UpdateImpactedNode", descendant.data.nodeid, descendant.x, descendant.y, true);
                                descendant.data.midpointconnections = nodeLocation.midpointconnections;
                                descendant.data.parentNodeConnection = nodeLocation.parentnodeconnection;
                                descendant.data.connection = nodeLocation.connection;
                                let linkdragged = d3.select("#gpathlink-" + descendant.data.parentNodeId + "-" + descendant.data.nodeid);
                                gLink.append(function () {
                                    linkdragged.select(".link").attr("d", diagonal({ source: nodeLocation.linkendpoints[0], target: nodeLocation.linkendpoints[1] }));
                                    linkdragged.select(".linkborder").attr("d", diagonal({ source: nodeLocation.linkendpoints[0], target: nodeLocation.linkendpoints[1] }));
                                    return linkdragged.remove().node();
                                });
                                gNode.append(function () {
                                    var nodedragged = d3.select("#node" + descendant.data.nodeid);
                                    nodedragged.attr("transform", "translate(" + descendant.x + "," + descendant.y + ")");
                                    return nodedragged.remove().node();
                                });
                            }
                            d3.select("#proximityrect" + descendant.data.nodeid)
                                .attr("transform", d => `translate(${descendant.x - proximityrectwidth / 2},${descendant.y - proximityrectheight / 2})`);
                        });
                        invokeDotNetMethodAsync(true, "UpdateProximityMapAsync", draggednodes);
                        d3.select("#draggroup").remove();
                        dragWithCtlKey = false;
                        d3.select("#node" + d.data.nodeid).attr("cursor", "pointer");
                    }
                    else {
                        singleNodeDragFinalise(d);
                    }
                    createcontexmenu(d);
                    if (Object.prototype.toString.call(event.sourceEvent).includes("TouchEvent")) {
                        document.activeElement.blur();
                    }
                });

        function checkLongTouch(d) {
            isLongTouch = true;
            setUpMultiNodeDrag(d);
        }

        function setUpMultiNodeDrag(d){
            dragWithCtlKey = true;
            groupdragx = 0;
            groupdragy = 0;
            d3.select("#draggroup").remove();
            var draggroup = svgGroup.append("g")
                .attr("id", "draggroup");
            var linkdraggroup = draggroup.append("g")
                .attr("id", "linkdraggroup")
                .attr("class", "glink");
            highlightnodes(d.descendants());
            d.descendants().forEach((descendant) => {
                if (d.data.nodeid != descendant.data.nodeid) {
                    draggroup.append(function () {
                        return d3.select("#node" + descendant.data.nodeid).remove().node();
                    });
                    linkdraggroup.append(function () {
                        return d3.select("#gpathlink-" + descendant.data.parentNodeId + "-" + descendant.data.nodeid)
                            .remove().node();
                    });
                }
            });
        }

        var newparentnodeid = -1;
        linkDragListener = d3.drag()
            .on("start", function (event, d) {
                if (event.sourceEvent.type === "touchstart") {
                    event.sourceEvent.preventDefault();
                }
                const selectedLink = d3.select("#link-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                const t = d.target.data.midpointconnections[d.target.data.connection];
                selectedLink.classed("linkdragging", true)
                    .attr("d", d => {
                        const o = { X: event.x, Y: event.y };
                        return diagonal({ source: o, target: t });
                    })
                    .attr("pointer-events", "none");
            })
            .on("drag", function (event, d) {
                const selectedLink = d3.select("#link-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                selectedLink.attr("d", p => {
                    const o = { x: event.x, y: event.y };
                    return diagonal({ source: o, target: d.target.data.midpointconnections[d.target.data.connection] });
                });
                var documentmouse = d3.pointers(event, d3.select("body").node())[0];
                var element = document.elementFromPoint(documentmouse[0], documentmouse[1]);
                if (element) {
                    if (element.id.includes("proximityrect")) {
                        highlightConnectionNode(d3.select(element).datum().data.nodeid, d.target.data.nodeid, event);
                    }
                }
            })
            .on("end", function (event, d) {
                const selectedLink = d3.select("#link-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                selectedLink
                    .classed("linkdragging", false)
                    .attr("pointer-events", "auto")
                    .attr("d", p => {
                        const o = { x: event.x, y: event.y };
                        return diagonal({ source: o, target: d.target.data.midpointconnections[d.target.data.connection] });
                    });

                var newparentnode = d3.select(".show");

                if (newparentnode.empty()) {
                    newparentnode = d3.select(".nodecontextmenu");
                }

                if (newparentnode.empty()) {
                    newparentnodeid = 0;
                }
                else {
                    newparentnodeid = newparentnode.datum().data.nodeid;
                }

                if (newparentnodeid === d.target.data.nodeid) { newparentnodeid = 0 };
                d3.selectAll(".show").classed("show", false);
                if (newparentnodeid === d.source.data.nodeid) {
                    selectedLink.attr("d", p => {
                        if (d.source.data.nodeid === 0) {
                            return null;
                        }
                        return diagonal({
                            source: d.source.data.midpointconnections[d.target.data.parentNodeConnection],
                            target: d.target.data.midpointconnections[d.target.data.connection]
                        });
                    });
                    return;
                }
                switchParent(d.target.data.nodeid, d.source.data.nodeid, newparentnodeid);
            });

        var resizeheight, resizewidth;
        var resizenode = d3.drag()
            .on("start", function (event, d) {
                event.sourceEvent.stopPropagation();
                d.data.autosize = false;
                resizeheight = d.data.height;
                resizewidth = d.data.width;
            })

            .on("drag", function (event, d) {
                resizeheight += event.dy;
                resizewidth += event.dx;
                let sizechanged = false;
                if (resizeheight > 1) {
                    d.data.height = resizeheight;
                    sizechanged = true;
                }
                if (resizewidth > 1) {
                    d.data.width = resizewidth;
                    sizechanged = true;
                }
                if (sizechanged) {
                    updateDimensions(d, false);
                };
            })

            .on("end", function (event, d) {
                updateDimensions(d, true);
            });

        function updateDimensions(d, updateProximityMap) {
            updateNodesDimensions([{
                nodeid: d.data.nodeid,
                height: d.data.height,
                width: d.data.width,
                autosize: d.data.autosize
            }], updateProximityMap);

            d3.select("#foid" + d.data.nodeid)
                .attr("width", d.data.width)
                .attr("height", d.data.height);

            d3.select("#rectid" + d.data.nodeid)
                .attr("width", d.data.width)
                .attr("height", d.data.height);
        };


        var highlightParentNode = function (proximalnodeid, event) {
            //TO DO - The minfier doesn't work if I make the function async
            DotNet.invokeMethodAsync("MapMyTime", "GetParentNodeIdFromProximalNodeAsync", proximalnodeid, d3.pointers(event, document.getElementsByTagName("g")[0])[0])
                .then(function (parentnodeid) {
                    highlightnode(parentnodeid);
                });
        };

        var highlightConnectionNode = function (proximalnodeid, sourcenodeid, event) {
            DotNet.invokeMethodAsync("MapMyTime", "GetConnectionNodeId", proximalnodeid, d3.pointers(event, document.getElementsByTagName("g")[0])[0], sourcenodeid)
                .then(function (parentnodeid) {
                    highlightnode(parentnodeid);
                });
        }

        async function createNewNode(parentnodeid, pointerposition) {
            let returnednode = await invokeDotNetMethodAsync(true, "AddNewNodeAsync", pointerposition, parentnodeid, defaultheight);
            var newnode = d3.hierarchy(JSON.parse(returnednode));
            var parentdata;
            var parentnode = d3.select("#node" + newnode.data.parentNodeId);
            if (parentnode.empty()) { parentdata = root; }
            else { parentdata = parentnode.datum(); }
            newnode.x0 = newnode.x = newnode.data.xCoordinate;
            newnode.y0 = newnode.y = newnode.data.yCoordinate;
            newnode.depth = newnode.data.nodedepth;
            newnode.parent = parentdata;
            if (!parentdata.children) {
                parentdata.children = [];
                parentdata.data.children = [];
            }
            parentdata.children.push(newnode);
            parentdata.data.children.push(newnode.data);
            d3update("enter");
            removeAllNodeContextMenus();
            if (!isTap) {
                setCursorPositionAtEndofText(newnode);
            }
            isTap = false;
        }

        function dragNode(d) {       
            var node = d3.select("#node" + d.data.nodeid);
            node.attr("transform", "translate(" + d.x + "," + d.y + ")");
            if (dragWithCtlKey) {
                if (d.data.parentNodeId !== 0) {
                    let nodeLocation = invokeDotNetMethod(true, "UpdateImpactedNode", d.data.nodeid, d.x, d.y, true);
                    d3.select("#link-" + d.data.parentNodeId + "-" + d.data.nodeid).attr("d", () => {
                        return diagonal({ source: nodeLocation.linkendpoints[1], target: nodeLocation.linkendpoints[0] });
                    });
                }
                d3.select("#draggroup")
                    .attr("transform", "translate(" + (d.x - initialX) + "," + (d.y - initialY) + ")");
            }
            else {
                recalcNodeLinks(d);
            }
        }

        function recalcNodeLinks(d) {
            let nodeLocations = invokeDotNetMethod(true, "RecalculateMovedNodeLinks",
                d.data.nodeid, d.x, d.y);

            nodeLocations.forEach((nodeLocation) => {
                if (nodeLocation.nodeid !== d.data.nodeid) {
                    d3.select("#link-" + d.data.nodeid + "-" + nodeLocation.nodeid)
                        .attr("d", () => {
                            return diagonal({ source: nodeLocation.linkendpoints[0], target: nodeLocation.linkendpoints[1] });
                        })
                }
                else {
                    if (d.data.parentNodeId !== 0) {
                        d3.select("#link-" + d.data.parentNodeId + "-" + nodeLocation.nodeid)
                            .attr("d", () => {
                                return diagonal({ source: nodeLocation.linkendpoints[0], target: nodeLocation.linkendpoints[1] });
                            })
                    }
                }
            });
        }
        function singleNodeDragFinalise(d) {
            var childpaths = d3.selectAll("path").filter('[id^="link-' + d.data.nodeid + '-"]');
            childpaths.attr("d", p => {
                let nodeLocation = invokeDotNetMethod(true, "UpdateImpactedNode",
                    p.target.data.nodeid, p.target.x, p.target.y, false);
                p.target.data.parentNodeConnection = nodeLocation.parentnodeconnection;
                p.target.data.connection = nodeLocation.connection;
                var returndiagonal = diagonal({ source: nodeLocation.linkendpoints[0], target: nodeLocation.linkendpoints[1] });
                d3.select("#linkborder-" + p.source.data.nodeid + "-" + p.target.data.nodeid)
                    .attr("d", returndiagonal);
                return returndiagonal;
            });
            invokeDotNetMethodAsync(true, "UpdateProximityMapAsync", [d.data.nodeid]);
            d3.select("#proximityrect" + d.data.nodeid)
                .attr("transform", d => `translate(${d.x - proximityrectwidth / 2},${d.y - proximityrectheight / 2})`);

        }

        function highlightnode(nodetohighlight) {
            var showingnodes = d3.selectAll(".show");
            if (showingnodes.size() === 1) {
                if (showingnodes.datum().data.nodeid === nodetohighlight) { return; }
            }
            if (!d3.selectAll(".asyncflag").empty()) {
                return;
            }
            showingnodes.classed("show", false);
            d3.select("#highlightRect" + nodetohighlight)
                .classed("show", true);
        }

        function highlightnodes(nodestohighlight) {
            var showingnodes = d3.selectAll(".show");
            showingnodes.classed("show", false);
            nodestohighlight.forEach((node) => {
                d3.select("#highlightRect" + node.data.nodeid)
                    .classed("show", true);
            });
        }

        function contextMenu() {
            var height,
                width,
                margin = 0.1,
                items = [],
                inputwidth,
                dimensionscalculated = false;

            function nodemenu(nodedata) {
                d3.select('.node-menu').remove();
                let autosize = nodedata.data.autosize;
                if (!dimensionscalculated) {
                    calculatedimensions(nodedata.data.nodeid, 10);
                }
                var nodestochange = getNodesToChange(nodedata.data.nodeid);

                gNode
                    .append('g').attr('class', 'node-menu')
                    .on("click", function (event) {
                        event.stopPropagation();
                    })
                    .on("mouseleave", () => {
                        d3.select('.node-menu').remove();
                        d3.selectAll(".nodetobechanged").classed("nodetobechanged", false);
                    })
                    .attr("transform", d =>
                        `translate(${nodedata.x + nodedata.data.width - 20},${nodedata.y})`)
                    .selectAll('tmp')
                    .data(d3.filter(items, function (d) {
                        if (d.attributename === "autosize") {
                            return (!autosize);
                        }
                        else { return true; }
                    })
                        , d => d.menutext)
                    .join(
                        function (enter) {
                            var menuelements = enter.append('g').attr('class', 'menu-entry');
                            menuelements
                                .append('rect')
                                .attr("id", d => "menurect" + d.attributename)
                                .attr('y', function (d, i) { return (i * height); })
                                .attr('width', width + inputwidth)
                                .attr('height', height)
                                .attr("data-fillcolour", nodedata.data.fill)
                                .attr("data-nodeid", nodedata.data.nodeid)
                                .classed("menurect", true);

                            menuelements
                                .append('text')
                                .text(d => d.menutext)
                                .attr('y', function (d, i) { return (i * height); })
                                .attr('dy', (height - margin / 2) * 0.75)
                                .attr('dx', margin)
                                .classed("menutext", true);

                            var menufo = menuelements.append("foreignObject")
                                .attr("id", d => d.attributename)
                                .on("keyup", function (d) { navigatecontextmenu(d, nodedata.data.nodeid); })
                                .attr("x", function (d) {
                                    if (d.attributename === "deletebutton") {
                                        return;
                                    }
                                    return width;
                                })
                                .attr('y', function (d, i) { return (i * height); })
                                .attr("width", function (d) {
                                    if (d.attributename === "deletebutton") {
                                        return width + inputwidth;
                                    }
                                    return inputwidth;
                                })
                                .attr("height", height)
                                .attr("data-menuparent", d => d.menuparent)

                            var menupar = menufo.append(menufo.attr("data-menuparent"))
                                .attr("data-menuelement", d => d.menuelement)
                                .attr("class", "contextmenudiv")

                            menupar.append(menupar.attr("data-menuelement"))
                                .attr("type", d => d.menutype)
                                .attr("id", d => "menuel" + d.attributename)
                                .classed("menuerange", d => (d.menutype === "range"))
                                .classed("menucheckbox", d => (d.menutype === "checkbox"))
                                .classed("trashbutton", d => (d.attributename === "deletebutton"))
                                .attr("width", function (d) {
                                    if (d.menutype === "color") { return inputwidth; }
                                    if (d.menutype === "button") { return inputwidth; }
                                    return null;
                                })
                                .text(function (d) {
                                    if (d.menutype === "button") { return "Delete"; }
                                    return null;
                                })
                                .attr("value", function (d) {
                                    if (d.menutype === "checkbox") { return null; }
                                    if (d.menutype === "button") { return "Delete"; }
                                    return Reflect.get(nodedata.data, d.attributename);
                                })
                                .property("checked", function (d) {
                                    if (d.menutype === "checkbox") {
                                        return Reflect.get(nodedata.data, d.attributename);
                                    }
                                    return false;
                                })
                                .attr("min", function (d) {
                                    if (d.menutype === "range") {
                                        return d.minvalue;
                                    }
                                    return null;
                                })
                                .attr("max", function (d) {
                                    if (d.menutype === "range") {
                                        return d.maxvalue;
                                    }
                                    return null;
                                })
                                .attr("step", function (d) {
                                    if (d.menutype === "range") {
                                        return 1;
                                    }
                                    return null;
                                })
                                .attr("data-nodeid", d => nodedata.data.nodeid)
                                .on("input", function (event, d) {
                                    event.stopPropagation();
                                    if (d.menutype === "checkbox") {
                                        invokeDotNetMethod(true, d.dotnetmethod, parseInt(this.dataset.nodeid), this.checked);
                                        Reflect.set(d3.select("#node" + this.dataset.nodeid).datum().data, d.attributename, this.checked);
                                        nodestochange = getNodesToChange(this.dataset.nodeid);
                                    }
                                    else {
                                        invokeDotNetMenuMethod(d.dotnetmethod, nodestochange, this.value);
                                        if (d.menutype === "color") {
                                            updatenodecolour(nodestochange, this.value);
                                        }
                                        else if (d.attributename === "fontsizepx") {
                                            updatefontsizes(nodestochange, parseInt(this.value));
                                        }
                                        else {
                                            reloadRootData();
                                            d3update("update");
                                        }
                                    }
                                })
                                .on("keydown", function (event) {
                                    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                                        event.preventDefault();
                                    }
                                })
                                .on("keyup", function (event, d) {
                                    if (event.key === " " || event.key === "Enter") {
                                        if (d.attributename === "deletebutton") {
                                            deleteNode(parseInt(this.dataset.nodeid));
                                        }
                                    }
                                })
                                .on("mousedown", function (event) { event.stopPropagation(); })
                                .on("change", function (event, d) {
                                    if (d.attributename === "fontsizepx") {
                                        updatefontsizes(nodestochange, parseInt(this.value));
                                    }
                                })
                                .on("mouseenter focus", function (event, d) {
                                    d3.select("#menurect" + d.attributename).attr("filter", "url(#makebrighterfilter)");
                                    if (d.attributename === "deletebutton") {
                                        setNodesForDeletion(nodestochange, true);
                                    }
                                    else { return null; }
                                })
                                .on("mouseleave blur", function (event, d) {
                                    d3.select("#menurect" + d.attributename).attr("filter", null);
                                    if (d.attributename === "deletebutton") {
                                        setNodesForDeletion(nodestochange, false);
                                    }
                                    else { return null; }
                                })
                                .on("mouseup", function (event, d) {
                                    if (d.attributename === "deletebutton") {
                                        deleteNode(parseInt(this.dataset.nodeid));
                                    }
                                    else { return null; }
                                });
                        })
            }

            nodemenu.items = function (e) {
                if (!arguments.length) return items;
                for (i in arguments[0]) items.push(arguments[0][i]);
                rescale = true;
                return nodemenu;
            }

            function calculatedimensions(nodeid, fontsize) {
                margin = 0.1;
                d3.select("#node" + nodeid).selectAll('temptext')
                    .data(items).enter()
                    .append('text')
                    .text(function (d) { return d.menutext; })
                    .attr('x', -1000)
                    .attr('y', -1000)
                    .attr('class', 'temptext')
                    .style("font-size", fontsize);

                var bbox = d3.selectAll('.temptext').nodes().map(function (x) { return x.getBBox(); });
                width = d3.max(bbox.map(function (x) { return x.width; }));
                margin = margin * width;
                width = width + 2 * margin;
                height = d3.max(bbox.map(function (x) { return (x.height + margin / 2) * 2; }));

                var menufo = d3.select("#node" + nodeid)
                    .append("foreignObject")
                    .attr("width", width * 0.5)
                    .attr("height", height)
                    .attr("class", "tempfo");
                var menupar = menufo.append("xhtml:div")
                    .attr("class", "contexmenuflexdiv");
                menupar.append("xhtml:input")
                    .attr("type", "color")
                    .attr("value", "#007BFF")
                    .attr("class", "tempinput");

                inputwidth = (d3.select(".tempinput").node().getBoundingClientRect().width / root.data.scale);// + 2 * margin;

                d3.selectAll(".temptext,.tempfo").remove();
                dimensionscalculated = true;
            }

            return nodemenu;
        }

        setConstantsAndBuildMap();

        async function setConstantsAndBuildMap() {
            var svgElement = document.getElementById("svg");
            if (svgElement) {
                document.getElementById("d3SVGdiv").removeChild(svgElement);
            }
            await setConstants();
            nodemenu = contextMenu().items(contextmenuitems);
            defaultheight = calculateDefaultNodeHeight();
            window.D3TimeMapUtilities.setSmallScreen();
            if (window.isScreenSmall) {
                defaultheight = defaultheight * 2;
            }
            if (isNewMap) {
                d3update("all");
            }

            document.getElementById("d3SVGdiv").appendChild(svgMain.node());

            svgMain.call(zoom.transform,
                d3.zoomIdentity.translate(root.data.xTranslate, root.data.yTranslate).scale(root.data.scale));

            createSaveIcon();
            window.D3TimeMapUtilities.positionIcons();
            if (!isNewMap) {
                //Refresh so node sizes can be calculated correctly
                d3updateAllNodes();
            }
            updateMapHasChanged(false);
        }

        function calculateDefaultNodeHeight() {
            var fo = gNode
                .append("foreignObject")
                .attr("height", 20)
                .attr("width", 60)
                .attr("x", -1000)
                .attr("y", -1000)
                .classed("tempfo nodefo", true);
            fo
                .append("xhtml:div")
                .attr("id", "defaultnodeheightdiv")
                .attr("contenteditable", "true")
                .text("temp")
                .classed("flexdiv tempdiv", true)
                .style("font-size", defaultfontsize);

            document.getElementById("d3SVGdiv").appendChild(svgMain.node());

            let height = d3.select("#defaultnodeheightdiv").node().scrollHeight;
            d3.selectAll(".tempdiv, .tempfo").remove();
            document.getElementById("d3SVGdiv").removeChild(svgMain.node());
            invokeDotNetMethod(window.mapHasChanged, "SetCalculatedNodeHeight", height);
            return height;
        }

        async function setConstants() {
            defaultwidth = await getConstants("defaultwidth");
            highlightrectboundary = await getConstants("highlightrectboundary");
            defaultfontsize = await getConstants("defaultfontsize");
            defaultnodetext = await getConstants("defaultnodetext");
            proximityrectheight = await getConstants("proximityrectheight");
            proximityrectwidth = await getConstants("proximityrectwidth");
            let contextmenustring = await invokeDotNetMethodAsync(window.mapHasChanged, "GetContextMenuItems");
            contextmenuitems = JSON.parse(contextmenustring);
        }

        async function getConstants(constantname) {
            return await invokeDotNetMethodAsync(window.mapHasChanged, "GetConstantAsync", constantname);
        }

        function reloadRootData() {
            root = d3.hierarchy(JSON.parse(invokeDotNetMethod(window.mapHasChanged, "GetTimeMapJson")));
            setRootDataXandYCoords(root);
        }
        async function reloadRootDataAsync() { //To do - is this a thing?
            let jsonmap = await DotNet.invokeMethodAsync("MapMyTime", "GetJsonDataAsync");
            root = d3.hierarchy(JSON.parse(jsonmap));
            setRootDataXandYCoords(root);
        }
        async function getNodesToChange(parentNodeId) {
            return await invokeDotNetMethodAsync(window.mapHasChanged, "ReturnNodesToChangeAsync", parseInt(parentNodeId));
        }
        function updateNodesDimensions(nodes, updateProximityMap) {
            let nodedimensions = [];
            nodes.forEach((node) => {
                let nodedimension = { nodeid: node.nodeid, height: node.height, width: node.width, autosize: node.autosize };
                nodedimensions.push(nodedimension);
            });
            updateNodeDimensions(JSON.stringify(nodedimensions), nodes, updateProximityMap);
        }
        async function updateNodeDimensions(nodedimensions, nodesarray, updateProximityMap) {
            let nodelocationdetails = await invokeDotNetMethodAsync(true, "UpdateNodeDimensionsAsync", nodedimensions, updateProximityMap);
            let updatednodes = [];
            nodelocationdetails.forEach((locationstring) => {
                let location = JSON.parse(locationstring)
                d3.select("#node" + location.nodeid).datum().data.midpointconnections = location.midpointconnections;
                d3.select("#node" + location.nodeid).datum().data.parentNodeConnection = location.parentnodeconnection;
                d3.select("#node" + location.nodeid).datum().data.connection = location.connection;
                updatednodes.push(location.nodeid);

            });
            d3updateNodesArray(updatednodes);
            //d3update();
        }

        function setRootDataXandYCoords(d3hierarchynode) {
            d3hierarchynode.descendants().forEach((d, i) => {
                if (d.data.nodeid === 0 && root.data.children.length === 0) {
                    d.x0 = d.x = 350;
                    d.y0 = d.y = 255;
                    isNewMap = true;
                }
                else {
                    d.x0 = d.x = d.data.xCoordinate;
                    d.y0 = d.y = d.data.yCoordinate;
                    d.depth = d.data.nodedepth;
                    isNewMap = false;
                }
            });
        };
        function createSaveIcon() {
            svgMain.append("image")
                .attr("id", "saveIcon")
                .classed("saveicon img-responsive", true)
                .attr("width", function () {
                    if (window.isScreenSmall) {
                        return "35";
                    }
                    else return "25";
                })
                .attr("height", function () {
                    if (window.isScreenSmall) {
                        return "35";
                    }
                    else return "25";
                })
                .attr("cursor", "pointer")
                .attr("xlink:href", "./css/open-iconic/icons/data-transfer-download.svg")
                .attr("alt", "download")
                .on("click", function (event) {
                    invokeDotNetMethod(false, "DownloadMap");
                    event.stopPropagation();
                });
        }
        function createcontexmenu(nodedata) {
            var menunode = d3.select("#node" + nodedata.data.nodeid).append("g")
                .attr('class', 'nodecontextmenu')
                .attr("id", "contextmenu" + nodedata.data.nodeid)

            menunode.append("rect")
                .attr("transform", d => `translate(${0},${-20})`)
                .attr("width", d => nodedata.data.width)
                .attr("height", 20)
                .attr("opacity", 0)
                .on("click", function (event) {
                    event.stopPropagation();
                });

            var contextmenuicon = menunode.append("g")

            contextmenuicon.append("path")
                .attr("id", "contextmenuicon")
                .attr("transform", d => `translate(${nodedata.data.width - 20},${-20})`)
                .attr("class", "contextmenuicon")
                .attr("d", "M 0, 4 H 15 m -15, 6 H 15 m -15, 6 H 15")

            contextmenuicon.append("rect")
                .attr("transform", d => `translate(${nodedata.data.width - 20},${-20})`)
                .attr("width", "20")
                .attr("height", "20")
                .attr("fill", "none")
                .attr("pointer-events", "visible")
                .on("mouseenter", function (event, d) { displaycontextmenu(nodedata); })
                .on("touchstart", function (event, d) {
                    if (d3.select("#contextmenuicon").classed("closeicon")) {
                        removeAllNodeContextMenus();
                    }
                    else {
                        const mouseenterevent = new Event("mouseenter");
                        this.dispatchEvent(mouseenterevent);
                    }
                    event.preventDefault();
                    event.stopPropagation();
                })
                .on("mousedown", function (event, d) {
                    if (d3.select("#contextmenuicon").classed("closeicon")) {
                        removeAllNodeContextMenus();
                    }
                    event.stopPropagation();
                });
        }

        function
            displaycontextmenu(nodedata) {
            if (d3.select(".node-menu").empty()) {
                d3.select("#contextmenuicon").attr("d", "M 0,4 L 12,16 M 0,16 L 12,4");
                d3.select("#contextmenuicon").classed("closeicon", true);
                nodemenu(nodedata);
                document.getElementById("menuel" + contextmenuitems[0].attributename).focus();
            }
            event.stopPropagation();
        }
        function navigatecontextmenu(menudata, nodeid) {
            if (event.key === "ArrowUp") {
                let menukey = contextmenuitems.findIndex(x => x.attributename === menudata.value.attributename);
                if (menukey === 0) {
                    removeAllNodeContextMenus();
                    document.getElementById("divid" + nodeid).focus();
                }
                else {
                    document.getElementById("menuel" + contextmenuitems[menukey - 1].attributename).focus();
                }
            }
            if (event.key === "ArrowDown") {
                let menukey = contextmenuitems.findIndex(x => x.attributename === menudata.value.attributename);
                let nextelement = document.getElementById("menuel" + contextmenuitems[menukey + 1].attributename);
                if (nextelement) {
                    nextelement.focus();
                }
                else {
                    removeAllNodeContextMenus();
                    document.getElementById("divid" + nodeid).focus();
                }
            }
        }

        function updatenodecolour(nodesarray, colour) {
            nodesarray.then(function (nodes) {
                nodes.forEach((nodeid) => {
                    d3.select("#node" + nodeid)
                        .attr("fill", colour)
                        .datum().data.fill = colour;
                });
            });
        }

        function updatefontsizes(nodesarray, fontsize) {
            nodesarray.then(function (nodes) {
                nodes.forEach((nodeid) => {
                    var node = d3.select("#node" + nodeid);
                    node.datum().data.fontsizepx = fontsize;
                });
                d3updateTheseNodes(nodesarray);
            });
        }

        function switchParent(childid, oldparentid, newparentid) {
            let returnednode = invokeDotNetMethod(true, "SwitchParent", [childid,
                oldparentid, newparentid]);
            let updatednode = d3.hierarchy(JSON.parse(returnednode));
            if (updatednode.data.parentNodeId === newparentid) {
                replaceChild(childid, oldparentid, newparentid, updatednode);
            }
            else {
                const changedNodes = new Set(invokeDotNetMethod(window.mapHasChanged, "GetChangedNodeSet").result);
                updateLinks(getChangedLinks(changedNodes), changedNodes);
            }
        }

        function removeNode(nodeid, parentnodeid) {
            var parentdata;
            if (parentnodeid === 0) {
                parentdata = root;
            }
            else {
                parentdata = d3.select("#node" + parentnodeid).datum();
            }

            parentdata.children.splice(parentdata.children.findIndex(x => x.data.nodeid === parseInt(nodeid)), 1);
            parentdata.data.children.splice(parentdata.data.children.findIndex(x => x.nodeid === parseInt(nodeid)), 1);
        }

        function addNewNode(newnode, parentnodeid) {
            var newparentdata;
            if (parentnodeid === 0) {
                newparentdata = root;
            }
            else {
                newparentdata = d3.select("#node" + parentnodeid).datum();
            }

            newnode.parent = newparentdata;

            if (!newparentdata.children) {
                newparentdata.children = [];
            }
            newparentdata.children.push(newnode);
            newparentdata.data.children.push(newnode.data);
        }

        function replaceChild(childid, oldparentid, newparentid, updatednode) {
            setRootDataXandYCoords(updatednode);

            removeNode(childid, oldparentid);
            addNewNode(updatednode, newparentid);

            d3updateReplaceChild(childid, oldparentid, newparentid);           
        }

        async function invokeDotNetMenuMethod(method, nodestochange, value) {
            let nodelist = await nodestochange;
            await DotNet.invokeMethodAsync("MapMyTime", method, nodelist, value);
        }

        function invokeDotNetMethod(changemap, method, ...values) {
            if (changemap !== window.mapHasChanged) {
                updateMapHasChanged(changemap);
            }
            return DotNet.invokeMethod("MapMyTime", method, ...values);
        }

        async function invokeDotNetMethodAsync(changemap, method, ...values) {
            if (changemap !== window.mapHasChanged) {
                updateMapHasChanged(changemap);
            }
            return DotNet.invokeMethodAsync("MapMyTime", method, ...values);
        }

        function updateMapHasChanged(changemap) {
            window.mapHasChanged = changemap;
            changemap ? d3.select("#saveIcon").attr("filter", "url(#redfilter") :
                d3.select("#saveIcon").attr("filter", null);
        }

        function setNodesForDeletion(nodelist, forDeletion) {
            nodelist.then(function (nodes) {
                nodes
                    .forEach((nodeitem) => {
                        if (forDeletion) {
                            d3.select("#node" + nodeitem).attr("filter", "url(#deletenodefilter)");
                        }
                        else {
                            d3.select("#node" + nodeitem).attr("filter", null);
                        }
                    });
            });
        }
        function deleteNode(nodeid) {
            let parentnodeid = d3.select("#node" + nodeid).datum().data.parentNodeId;
            let notdeletednodes = invokeDotNetMethod(true, "DeleteNode", nodeid);
            removeNode(nodeid, parentnodeid);
            if (notdeletednodes.length > 0) {
                notdeletednodes.forEach((movednode) => {
                    let newnode = d3.hierarchy(JSON.parse(movednode));
                    setRootDataXandYCoords(newnode);
                    addNewNode(newnode, parentnodeid);
                })
                d3update();
            }
            removeAllNodeContextMenus();
            d3update();
        }

        function removeAllNodeContextMenus() {
            d3.selectAll(".node-menu").remove();
            d3.selectAll(".nodecontextmenu").remove();
        }

        function setCursorPositionInNode(d3data) {
            if (d3data.data.name.startsWith(defaultnodetext)) {
                setCursorPositionAtEndofText(d3data);
                return;
            }
            let range, textNode, offset, sel, newrange;

            if (document.caretPositionFromPoint) {
                range = document.caretPositionFromPoint(event.clientX, event.clientY);
                textNode = range.offsetNode;
                offset = range.offset;
            } else if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(event.clientX, event.clientY);
                textNode = range.startContainer;
                offset = range.startOffset;
            }
            if (textNode) {
                newrange = document.createRange();
                sel = window.getSelection();
                newrange.setStart(textNode, offset);
                newrange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newrange);
            }
            else {
                setCursorPositionAtEndofText(d3data);
                document.getElementById("divid" + d3data.data.nodeid).focus();
                return;
            }
        }

        function setCursorPositionAtEndofText(d3data) {
            var divelement = document.getElementById("divid" + d3data.data.nodeid),
                selection = window.getSelection(),
                range = document.createRange(),
                offset = 1;
            if (d3data.data.name.startsWith(defaultnodetext)) {
                offset = 0;
            }
            range.setStart(divelement, offset);
            range.setEnd(divelement, 1);
            selection.removeAllRanges();
            selection.addRange(range);
            divelement.focus();
        }

        function handlekeyboardevent(d3data) {
            if (event.altKey && event.shiftKey) {
                if (event.key.startsWith("Arrow")) {
                    let arrowResult = JSON.parse(invokeDotNetMethod(window.mapHasChanged, "ProcessArrowEvent",
                        event.key, d3data.data.nodeid));
                    if (arrowResult.navigatetoid > 0) {
                        let resultData = d3.select("#node" + arrowResult.navigatetoid).datum();
                        setCursorPositionAtEndofText(resultData);
                    }
                    else {
                        if (arrowResult.navigatetoid === 0 && arrowResult.newnodeparentid != 0) {
                            let mousposition = [arrowResult.x, arrowResult.y];
                            createNewNode(arrowResult.newnodeparentid, mousposition);
                        }
                    }
                }
            }
            if (event.altKey) {
                if (event.key === "m") {
                    displaycontextmenu(d3data);
                }
            }
        }

        function getChangedNodes(changedNodeSet) {
            invokeDotNetMethod(window.mapHasChanged, "ClearChangedNodeSet");

            if (changedNodeSet.size === 0 || (changedNodeSet.size === 1 && changedNodeSet["$0"] === "0")) {
                return root.descendants();
            }

            return root.descendants().filter(node => changedNodeSet.has(node.data.nodeid));
        }

        function getChangedLinks(changedNodeSet) {
            invokeDotNetMethod(window.mapHasChanged, "ClearChangedNodeSet");

            if (changedNodeSet.size === 0 || (changedNodeSet.size === 1 && changedNodeSet["$0"] === "0")) {
                return root.links();
            }
            return root.links().filter(node => changedNodeSet.has(node.source.data.nodeid) && changedNodeSet.has(node.target.data.nodeid))
        }

        function addParentNodesToChangedNodeSet(changedNodeSet) {
            if (changedNodeSet.size === 0 || (changedNodeSet.size === 1 && changedNodeSet["$0"] === "0")) {
                return changedNodeSet;
            }
            var parentNodeIds = root.descendants().filter(node => changedNodeSet.has(node.data.nodeid)).map(node => node.data.parentNodeId);
            parentNodeIds.forEach(item => changedNodeSet.add(item));
            return changedNodeSet;
        }

        function getChangedLinkLumps(changedNodeSet) {
            if (changedNodeSet.size === 0 || (changedNodeSet.size === 1 && changedNodeSet["$0"] === "0")) {
                return root.links();
            }
            return root.links().filter(node => changedNodeSet.has(node.target.data.nodeid) && node.target.depth === 1)
        }

        function filterGpath(d, changedNodeSet) {
            if (changedNodeSet.size === 0 || (changedNodeSet.size === 1 && changedNodeSet["$0"] === "0")) {
                return true;
            }
            var theResult = (changedNodeSet.has(d.target.data.nodeid) && changedNodeSet.has(d.source.data.nodeid));
            return theResult;
        }

        function d3update() {
            const changedNodes = new Set(invokeDotNetMethod(window.mapHasChanged, "GetChangedNodeSet").result);
            let nodes = getChangedNodes(changedNodes);

            nodeUpdate(nodes, changedNodes);
            updateLinks(getChangedLinks(changedNodes), changedNodes);
            updateProximityRects(nodes, changedNodes);
        }

        function d3updateReplaceChild(childid, oldparentid, newparentid) {
            const changedNodes = new Set(invokeDotNetMethod(window.mapHasChanged, "GetChangedNodeSet").result);
            let nodes = getChangedNodes(changedNodes);
            nodeUpdate(nodes, changedNodes);

            updateLinks(getChangedLinks(new Set().add(newparentid).add(childid).add(oldparentid)),
                new Set().add(newparentid).add(childid).add(oldparentid));

            updateProximityRects(nodes, changedNodes);
        }

        function d3linkupdate() {
            const changedNodes = new Set(invokeDotNetMethod(window.mapHasChanged, "GetChangedNodeSet").result);
            updateLinks(getChangedLinks(changedNodes), changedNodes);
        }

        function d3updateTheseNodes(nodesArray) {
            nodesArray.then(function (nodes) {
                d3updateNodesArray(nodes)
            })
        }

        function d3updateNodesArray(nodesArray) {
            nodesToUpdate = root.descendants().filter(node => new Set(nodesArray).has(node.data.nodeid))
            nodeUpdate(nodesToUpdate, new Set(nodesArray));
            const nodeSetWithParents = addParentNodesToChangedNodeSet(new Set(nodesArray));
            updateLinks(getChangedLinks(nodeSetWithParents), nodeSetWithParents);
            updateProximityRects(nodesToUpdate, new Set(nodesArray));
        }

        function d3updateAllNodes() {
            const changedNodes = new Set();
            nodeUpdate(root.descendants(), changedNodes);
            updateLinks(root.links(), changedNodes);
            updateProximityRects(root.descendants(), changedNodes);
            invokeDotNetMethod(window.mapHasChanged, "ClearChangedNodeSet");
        }

        function nodeUpdate(nodes, changedNodeSet) {
            //const nodes = root.descendants();
            const transition = svgGroup.transition()
                .duration(duration);
            // Update the nodes…
            var nodeswithchangedheight = [];
            gNode.selectAll(".standardNode")
                .filter(function (d, i) {
                    if (changedNodeSet.size === 0) { return true; }
                    return changedNodeSet.has(d.data.nodeid)
                })
                .data(nodes.filter(d => d.depth), d => d.data.nodeid)
                .join(
                    enter =>
                        enter.append("g")
                            .on("touchstart", function (event, d) {
                                dragTimer = d3.timeout(() => (checkLongTouch(d)), 500);
                                event.preventDefault();
                                isLongTouch = false;                              
                            })
                            .on("touchmove", function (event, d) {
                                dragTimer.stop();
                            })
                            .call(nodeDragListener)
                            .style("touch-action", "auto")
                            .attr("transform", d => `translate(${d.x},${d.y})`)
                            .attr("fill-opacity", 1)
                            .attr("stroke-opacity", 1)
                            .attr("id", d => "node" + d.data.nodeid)
                            .attr("fill", d => d.data.fill)
                            .attr("cursor", "pointer")
                            .classed("standardNode", true)
                            .on("mouseenter", function (event, d) {
                                if (d3.select("#contextmenu" + d.data.nodeid).empty() && (!hasBeenDragged)) {
                                    removeAllNodeContextMenus();
                                    createcontexmenu(d);
                                    if (document.activeElement !== document.getElementById("divid" + d.data.nodeid)) {
                                        setCursorPositionAtEndofText(d);
                                    }
                                }
                            })
                            .on("mouseleave", function (d) {
                                d3.selectAll(".nodecontextmenu").remove();
                            })
                            .on("touchend", function (event, d) {
                                isLongTouch = false;
                            })
                            .on("click", function (event, d) {
                                if (!event.srcElement.id.startsWith("divid")) {
                                    setCursorPositionAtEndofText(d);
                                }
                                event.stopPropagation();
                            })
                            .each(function (d) {
                                d3.select(this).append("rect")
                                    .attr("id", d => "rectid" + d.data.nodeid)
                                    .attr("class", "noderect")
                                    .attr("width", d => d.data.width)
                                    .attr("height", d => d.data.height)
                                    .attr("rx", 2)
                                    .attr("ry", 2)
                                    .attr("stroke", "#cce9e5");

                                d3.select(this).append("foreignObject")
                                    .attr("id", d => "foid" + d.data.nodeid)
                                    .attr("class", "nodefo")
                                    .attr("width", d => d.data.width)
                                    .attr("height", d => d.data.height)//)
                                    //Stack overflow 2388164
                                    .each(function (d) {
                                        d3.select(this).append("xhtml:div")
                                            .attr("id", d => "divid" + d.data.nodeid)
                                            .attr("tabindex", d => d.data.nodeid)
                                            .attr("contenteditable", "true")
                                            .attr("class", "flexdiv")
                                            .style("font", d => d.data.fontsizepx + "px sans-serif")
                                            .html(d => d.data.name)
                                            .on("touchend", function (d) {
                                                window.touchTrigger = true;
                                                window.touchedData = d;
                                            })
                                            .on("mousedown", function (event) {
                                                if (editingNode === this.id) {
                                                    event.stopPropagation();
                                                }
                                            })
                                            .on("click", function (event, d) {
                                                if (!editingNode === this.id) {
                                                    setCursorPositionInNode(d);
                                                }
                                                editingNode = this.id;
                                            })
                                            .on("blur", function (event, d) {
                                                editingNode = "";
                                                if (d.data.name !== this.innerHTML) {
                                                    d.data.name = this.innerHTML;
                                                    invokeDotNetMethodAsync(true, "UpdateText", d.data.nodeid, this.innerHTML);
                                                }
                                            })
                                            .on("keydown", function (event, d) {
                                                handlekeyboardevent(d);
                                                event.stopPropagation();
                                            })
                                            .on("keyup", function (event, d) {
                                                if (d.data.autosize) {
                                                    var divScrollHeight = this.scrollHeight;
                                                    var changeHeight = false;
                                                    if (window.isScreenSmall) {
                                                        if (divScrollHeight > defaultheight && d.data.height !== divScrollHeight) {
                                                            changeHeight = true;
                                                        }
                                                    }
                                                    else {
                                                        if (d.data.height !== divScrollHeight) {
                                                            changeHeight = true;
                                                        }
                                                    }
                                                    if (changeHeight) {
                                                        d.data.height = divScrollHeight;
                                                        updateNodesDimensions([{
                                                            nodeid: d.data.nodeid,
                                                            height: d.data.height,
                                                            width: d.data.width,
                                                            autosize: d.data.autosize
                                                        }], true);
                                                        d3.select("#" + "rectid" + d.data.nodeid).attr("height", d.data.height);
                                                        d3.select("#foid" + d.data.nodeid)
                                                            .attr("height", d.data.height);
                                                        d3.select("#highlightRect" + d.data.nodeid)
                                                            .attr("height", d.data.height + highlightrectboundary);
                                                        d3.select("#resizehandle" + d.data.nodeid)
                                                            .attr("cy", d.data.height);
                                                        d3.select("#proximityrect" + d.data.nodeid)
                                                            .attr("height", d.data.height + (proximityrectheight));
                                                    };
                                                };
                                            })
                                            .on("paste", function (event, d) {
                                                if (d.data.autosize) {
                                                    var divelement = this;
                                                    setTimeout(function () { divelement.dispatchEvent(new Event("keyup")); });
                                                }
                                            })
                                    });

                                d3.select(this).append("circle")
                                    .attr("id", d => "resizehandle" + d.data.nodeid)
                                    .attr("cx", d => d.data.width)
                                    .attr("cy", d => d.data.height)
                                    .attr("class", "resizehandle")
                                    .attr("r", 7)
                                    .attr("fill", d => d.data.fill)
                                    .call(resizenode);

                                d3.select(this).append("rect")
                                    .attr('class', 'highlightRect')
                                    .attr("id", d => "highlightRect" + d.data.nodeid)
                                    .attr("transform", "translate(-3,-3)")
                                    .attr("width", d => d.data.width + 6)
                                    .attr("height", function (d) {
                                        if (d.data.autosize) {
                                            if (d3.select("#divid" + d.data.nodeid).node()) {
                                                var divScrollHeight = d3.select("#divid" + d.data.nodeid).node().scrollHeight;
                                                var changeHeight = false;
                                                if (window.isScreenSmall) {
                                                    if (divScrollHeight > defaultheight && d.data.height !== divScrollHeight) {
                                                        changeHeight = true;
                                                    }
                                                }
                                                else {
                                                    if (d.data.height !== divScrollHeight) {
                                                        changeHeight = true;
                                                    }
                                                }
                                                if (changeHeight) {
                                                    d.data.height = divScrollHeight;
                                                    nodeswithchangedheight.push(d.data);
                                                    d3.select("#rectid" + d.data.nodeid).attr("height", d.data.height);
                                                    d3.select("#resizehandle" + d.data.nodeid).attr("cy", d.data.height);
                                                    d3.select("#foid" + d.data.nodeid).attr("height", d.data.height);
                                                }
                                            }
                                        }
                                        return d.data.height + highlightrectboundary;
                                    })
                                    .attr("rx", 2)
                                    .attr("ry", 2)
                                    .attr("opacity", 0.2) // change this to zero to hide the target area
                                    .style("fill", "red")
                                    .attr('pointer-events', 'none');

                                return enter;
                            }),

                    update =>
                        update
                            .attr("transform", d => `translate(${d.x},${d.y})`)
                            .attr("fill", d => d.data.fill)
                            .attr("class", d => d.data.cssClass)
                            .each(function (d) {

                                d3.select(this).select(".flexdiv")
                                    .style("font", d => d.data.fontsizepx + "px sans-serif");

                                d3.select(this).select(".noderect")
                                    .attr("height", function (d) {
                                        if (d.data.autosize) {
                                            var divScrollHeight = d3.select("#divid" + d.data.nodeid).node().scrollHeight;
                                            var changeHeight = false;
                                            if (window.isScreenSmall) {
                                                if (divScrollHeight > defaultheight && d.data.height !== divScrollHeight) {
                                                    changeHeight = true;
                                                }
                                            }
                                            else {
                                                if (d.data.height !== divScrollHeight) {
                                                    changeHeight = true;
                                                }
                                            }
                                            if (changeHeight) {
                                                d.data.height = divScrollHeight;
                                                nodeswithchangedheight.push(d.data);
                                            }
                                        }
                                        return d.data.height;
                                    })
                                    .attr("width", d => d.data.width);

                                d3.select(this).select(".nodefo")
                                    .attr("height", d => d.data.height)
                                    .attr("width", d => d.data.width);

                                d3.select(this).select(".resizehandle")
                                    .attr("cx", d => d.data.width)
                                    .attr("cy", d => d.data.height);

                                d3.select(this).select(".highlightRect")
                                    .attr("height", d => d.data.height + highlightrectboundary)
                                    .attr("width", d => d.data.width + highlightrectboundary);

                                d3.select(this).select(".linklump")
                                    .attr("cx", d => d.data.width / 2);
                            }),
                    exit => {
                        exit
                            .call(exit => exit.transition(transition).remove()
                                .attr("transform", d => `translate(${viewboxx - 24},${4})`)
                                .attr("fill-opacity", 0)
                                .attr("stroke-opacity", 0))
                    }
                ); //This is the end of the join

            if (nodeswithchangedheight.length > 0) {
                updateNodesDimensions(nodeswithchangedheight, true);
            }
        };
        
        function updateLinks(changedLinks, changedNodeSet) {
            gLink.selectAll(".gpath")
                .filter(function (d, i) {
                    return filterGpath(d, changedNodeSet);
                })
                .data(changedLinks, d => d)
                .join(
                    function (enter) {
                        var pathGroup = enter.append("g")
                            .attr("id", d => {
                                return ("gpathlink-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                            })
                            .classed("gpath", true);
                        pathGroup.append("path")
                            .call(linkDragListener)
                            .classed("link", true)
                            .attr("id", d => {
                                return ("link-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                            })
                            .attr("d", d => {
                                if (d.source.data.nodeid === 0) {
                                    return null;
                                }
                                return diagonal({
                                    source: d.source.data.midpointconnections[d.target.data.parentNodeConnection],
                                    target: d.target.data.midpointconnections[d.target.data.connection]
                                });
                            });
                        pathGroup.append("path")
                            .call(linkDragListener)
                            .classed("linkborder", true)
                            .attr("id", d => {
                                return ("linkborder-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                            })
                            .attr("d", d => {
                                if (d.source.data.nodeid === 0) {
                                    return null;
                                }
                                return diagonal({
                                    source: d.source.data.midpointconnections[d.target.data.parentNodeConnection],
                                    target: d.target.data.midpointconnections[d.target.data.connection]
                                });
                            })
                    },
                    update => {
                        update.attr("id", d => {
                            return ("gpathlink-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                        })
                        update.select(".link")
                            .attr("id", d => {
                                return ("link-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                            })
                            .attr("d", d => {
                                if (d.source.data.nodeid === 0) {
                                    return null;
                                }
                                return diagonal({
                                    source: d.source.data.midpointconnections[d.target.data.parentNodeConnection],
                                    target: d.target.data.midpointconnections[d.target.data.connection]
                                });
                            });
                        update.select(".linkborder")
                            .attr("id", d => {
                                return ("linkborder-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                            })
                            .attr("d", d => {
                                if (d.source.data.nodeid === 0) {
                                    return null;
                                }
                                return diagonal({
                                    source: d.source.data.midpointconnections[d.target.data.parentNodeConnection],
                                    target: d.target.data.midpointconnections[d.target.data.connection]
                                });
                            })
                    }
                    ,
                    exit => {
                        exit
                            .call(exit => exit.remove())
                    }
            );
            updateLinkLumps(changedLinks, changedNodeSet)
        };

        function updateLinkLumps(changedLinks, changedNodeSet) {
            var allChangedLinks = getChangedLinkLumps(changedNodeSet);
            lumpNodes.selectAll(".linklump")
                .filter(function (d, i) {
                    if (changedNodeSet.size === 0) { return true; }
                    return (changedNodeSet.has(d.target.data.nodeid))
                })
                .data(allChangedLinks.filter(d => d.target.data.nodeid))
                .join(
                    enter =>
                        enter.append("image")
                            .call(linkDragListener)
                            .attr("transform", d => `translate(${d.target.x + (d.target.data.width / 2) - 4},${d.target.y - 8})`)
                            .attr("width", 9)
                            .attr("height", 9)
                            .attr("class", "linklump")
                            .attr("id", d => "linklump" + d.target.data.nodeid)
                            .style("color", d => d.target.data.fill)
                            .attr("xlink:href", "./css/open-iconic/icons/caret-top.svg"),
                    update =>
                        update
                            .attr("transform", d => `translate(${d.target.x + (d.target.data.width / 2) + -4},${d.target.y - 8})`),
                    exit =>
                        exit.remove()
                );
        }

        function updateProximityRects(nodes, changedNodeSet) {
            proximityRect.selectAll(".proximityRect")
                .filter(function (d, i) {
                    if (changedNodeSet.size === 0) { return true; }
                    return changedNodeSet.has(d.data.nodeid)
                })
                .data(nodes.filter(d => d.depth), d => d.data.nodeid)
                .join(
                    enter =>
                        enter.append("rect")
                            .classed("proximityRect", true)
                            .attr("id", d => "proximityrect" + d.data.nodeid)
                            .attr("transform", d => `translate(${d.x - proximityrectwidth / 2},${d.y - proximityrectheight / 2})`)
                            .attr("width", d => d.data.width + proximityrectwidth)
                            .attr("height", d => d.data.height + proximityrectheight)
                            .attr("opacity", 0) // change this to zero to hide the target area
                            .style("fill", "grey")
                            .on("mousemove", function (event, d) {
                                highlightParentNode(d.data.nodeid, event);
                            })
                            .on("mouseout", function (event) {
                                if (!event.relatedTarget) {
                                    d3.selectAll(".show").classed("asyncflag", true);
                                    d3.selectAll(".highlightRect").classed("show", false);
                                }
                                else {
                                    if (!d3.select(event.relatedTarget).classed("proximityRect")) {
                                        d3.selectAll(".show").classed("asyncflag", true);
                                        d3.selectAll(".highlightRect").classed("show", false);
                                    }
                                }
                            })
                            .on("mouseenter", function () {
                                d3.select('.node-menu').remove();
                                d3.selectAll(".asyncflag").classed("asyncflag", false);
                            })
                    ,

                    update =>
                        update
                            .attr("transform", d => `translate(${d.x - proximityrectwidth / 2},${d.y - proximityrectheight / 2})`)
                            .attr("width", d => d.data.width + proximityrectwidth)
                            .attr("height", d => d.data.height + proximityrectheight)
                    ,
                    exit => exit.remove()
                );
        }
    }
};

window.addEventListener("resize", window.D3TimeMapUtilities.positionIcons);
window.addEventListener("beforeunload", function (e) {
    if (window.mapHasChanged) {
        e.preventDefault();
        e.returnValue = '';
    }
});

